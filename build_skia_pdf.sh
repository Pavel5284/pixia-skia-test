#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-/output}"
SKIA_DIR="/build/skia"

echo "=== Skia WASM + PDF backend builder ==="
echo "Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "[1/5] Cloning Skia..."
if [ ! -d "$SKIA_DIR/.git" ]; then
    # Directory may be a Docker volume mount (can't be removed)
    if [ -d "$SKIA_DIR" ]; then
        git clone https://skia.googlesource.com/skia.git "$SKIA_DIR.tmp" --depth=1
        cp -r "$SKIA_DIR.tmp"/. "$SKIA_DIR/"
        rm -rf "$SKIA_DIR.tmp"
    else
        git clone https://skia.googlesource.com/skia.git "$SKIA_DIR" --depth=1
    fi
fi
cd "$SKIA_DIR"

echo "   Patching DEPS to skip dawn and swiftshader..."
python3 - << 'PYEOF'
import re
with open('DEPS', 'r') as f:
    content = f.read()
for dep in ['dawn', 'swiftshader']:
    content = re.sub(r'(\s*"[^"]*' + dep + r'[^"]*"\s*:)', r'  # SKIPPED\1', content)
with open('DEPS', 'w') as f:
    f.write(content)
print("DEPS patched OK")
PYEOF

echo "   Syncing dependencies..."
for attempt in 1 2 3; do
    echo "   Attempt $attempt/3..."
    if python3 tools/git-sync-deps; then
        echo "   Sync OK"
        break
    else
        if [ "$attempt" -eq 3 ]; then
            echo "   WARNING: continuing anyway..."
        else
            sleep 5
        fi
    fi
done

echo "[2/5] Applying PDF patch..."
BINDINGS_FILE="$SKIA_DIR/modules/canvaskit/canvaskit_bindings.cpp"
if grep -q "PDF_BeginPage" "$BINDINGS_FILE"; then
    echo "   Already patched."
else
    sed -i 's|#include "include/core/SkStream.h"|#include "include/core/SkStream.h"\n#include "include/docs/SkPDFDocument.h"|' "$BINDINGS_FILE"
    cat >> "$BINDINGS_FILE" << 'CPP_EOF'

static SkCanvas* PDF_BeginPage(uintptr_t docPtr, float width, float height) {
    return reinterpret_cast<SkDocument*>(docPtr)->beginPage(width, height);
}
static void PDF_EndPage(uintptr_t docPtr) {
    SkDocument* doc = reinterpret_cast<SkDocument*>(docPtr);
    doc->endPage();
}
static void PDF_Close(uintptr_t docPtr) {
    SkDocument* doc = reinterpret_cast<SkDocument*>(docPtr);
    doc->close();
}
static Uint8Array PDF_GetData(uintptr_t streamPtr) {
    auto* s = reinterpret_cast<std::shared_ptr<SkDynamicMemoryWStream>*>(streamPtr);
    sk_sp<SkData> data = (*s)->detachAsData();
    delete s;
    return toBytes(data);
}
static JSObject PDF_MakeDocument(float width, float height) {
    auto stream = std::make_shared<SkDynamicMemoryWStream>();
    SkPDF::Metadata meta;
    meta.fRasterDPI = 72;
    // Bypass JPEG codec check — Skia's WASM build may not have
    // SK_CODEC_DECODES_JPEG/SK_CODEC_ENCODES_JPEG defined for the :pdf target,
    // which causes SkPDF::MakeDocument to abort. Setting allowNoJpegs=true
    // skips the JPEG requirement (images are embedded as raw bitmaps).
    meta.allowNoJpegs = true;
    auto doc = SkPDF::MakeDocument(stream.get(), meta);
    if (!doc) return emscripten::val::null();
    JSObject result = emscripten::val::object();
    result.set("_docPtr", static_cast<double>(reinterpret_cast<uintptr_t>(doc.release())));
    result.set("_streamPtr", static_cast<double>(reinterpret_cast<uintptr_t>(new std::shared_ptr<SkDynamicMemoryWStream>(stream))));
    result.set("_width", width);
    result.set("_height", height);
    return result;
}
EMSCRIPTEN_BINDINGS(SkiaPDF) {
    using namespace emscripten;
    function("MakePDFDocument", &PDF_MakeDocument);
    function("_pdf_beginPage",  &PDF_BeginPage, allow_raw_pointers());
    function("_pdf_endPage",    &PDF_EndPage);
    function("_pdf_close",      &PDF_Close);
    function("_pdf_getData",    &PDF_GetData);
}
CPP_EOF
    echo "   Patch applied"
fi

echo "[3/5] Setting up emsdk..."
EMSDK_DIR="$SKIA_DIR/third_party/externals/emsdk"

# activate-emsdk — Python скрипт, запускаем через python3
python3 "$SKIA_DIR/bin/activate-emsdk"

# Устанавливаем и активируем нужную версию emsdk
cd "$EMSDK_DIR"
./emsdk install latest
./emsdk activate latest
source "$EMSDK_DIR/emsdk_env.sh"

echo "   emcc: $(emcc --version | head -1)"

echo "[4/5] Compiling (20-40 min)..."
cd "$SKIA_DIR/modules/canvaskit"

# compile.sh has skia_enable_pdf=false hardcoded — fix it
sed -i 's/skia_enable_pdf=false/skia_enable_pdf=true/' compile.sh

bash compile.sh is_debug=false extra_cflags='["-DCK_ENABLE_PDF"]'
echo "   Done"

echo "[5/5] Copying artifacts..."
# compile.sh outputs to $SKIA_DIR/out/canvaskit_wasm/ (or _debug/_profile)
BUILD_OUT="$SKIA_DIR/out/canvaskit_wasm/canvaskit.js"
if [ ! -f "$BUILD_OUT" ]; then
    echo "Not found, searching for canvaskit.js..."
    BUILD_OUT=$(find "$SKIA_DIR/out" -name "canvaskit.js" -type f 2>/dev/null | head -1)
fi
if [ -z "$BUILD_OUT" ]; then
    echo "ERROR: canvaskit.js not found"
    find "$SKIA_DIR/modules/canvaskit" -name "*.js" -type f 2>/dev/null || true
    exit 1
fi
BUILD_DIR=$(dirname "$BUILD_OUT")
echo "Found in: $BUILD_DIR"
# Post-process: convert CJS export to ESM (Vite/Rollup needs `export default`)
cp "$BUILD_DIR/canvaskit.js"   "$OUTPUT_DIR/canvaskit.js"
# Ensure the WASM file exists from the same build
if [ ! -f "$BUILD_DIR/canvaskit.wasm" ]; then
    find "$BUILD_DIR" -name "*.wasm" -type f 2>/dev/null
    WASM_FILE=$(find "$BUILD_DIR" -name "*.wasm" -type f 2>/dev/null | head -1)
    cp "$WASM_FILE" "$OUTPUT_DIR/canvaskit.wasm"
else
    cp "$BUILD_DIR/canvaskit.wasm" "$OUTPUT_DIR/canvaskit.wasm"
fi

# Post-process: convert CJS export to ESM (Vite/Rollup needs `export default`)
sed -i 's/if (typeof exports === .*$/export default CanvasKitInit;/' "$OUTPUT_DIR/canvaskit.js"
sed -i '/module\.exports = CanvasKitInit;/d' "$OUTPUT_DIR/canvaskit.js"
sed -i '/module\.exports\.default = CanvasKitInit;/d' "$OUTPUT_DIR/canvaskit.js"
sed -i '/else if (typeof define === .*$/d' "$OUTPUT_DIR/canvaskit.js"
sed -i '/^  define(\[\]/d' "$OUTPUT_DIR/canvaskit.js"
echo "=== BUILD SUCCESSFUL ==="
ls -lh "$OUTPUT_DIR/canvaskit.js" "$OUTPUT_DIR/canvaskit.wasm"