import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Canvas } from 'skia';
import { getGraphicsData, getSpriteSource, bgColorSkia } from '../shared/geometry';
import { pixiColorToSkia, buildSkiaPath, usePaint } from '../shared/skia-utils';

/** Рекурсивно рендерит PIXI.DisplayObject на PDF-канвасе (векторный экспорт) */
function renderDisplayObjectToPdfCanvas(
    ck: CanvasKit,
    canvas: Canvas,
    obj: PIXI.DisplayObject,
): void {
    if (!obj.visible || obj.worldAlpha <= 0) return;

    canvas.save();

    const { x, y } = obj.position;
    const { x: sx, y: sy } = obj.scale;
    const rad = obj.rotation;

    canvas.translate(x, y);
    canvas.rotate(rad * (180 / Math.PI), 0, 0);
    canvas.scale(sx, sy);

    if (obj instanceof PIXI.Graphics) {
        obj.finishPoly();
        for (const data of getGraphicsData(obj)) {
            const { shape, lineStyle, fillStyle } = data;
            const skPath = buildSkiaPath(ck, shape);
            if (!skPath) continue;

            try {
                if (fillStyle?.visible && fillStyle.alpha > 0) {
                    usePaint(ck, (p) => {
                        p.setStyle(ck.PaintStyle.Fill);
                        p.setColor(pixiColorToSkia(fillStyle.color, fillStyle.alpha));
                        p.setAntiAlias(true);
                    }, (p) => canvas.drawPath(skPath, p));
                }

                if (lineStyle?.visible && lineStyle.width > 0 && lineStyle.alpha > 0) {
                    usePaint(ck, (p) => {
                        p.setStyle(ck.PaintStyle.Stroke);
                        p.setColor(pixiColorToSkia(lineStyle.color, lineStyle.alpha));
                        p.setStrokeWidth(lineStyle.width);
                        p.setAntiAlias(true);
                    }, (p) => canvas.drawPath(skPath, p));
                }
            } finally {
                skPath.delete();
            }
        }
    }

    if (obj instanceof PIXI.Sprite && obj.texture?.baseTexture) {
        const source = getSpriteSource(obj);
        if (source) {
            const skImg = ck.MakeImageFromCanvasImageSource(source);
            if (skImg) {
                try {
                    usePaint(ck, (p) => p.setAlphaf(obj.worldAlpha), (p) => canvas.drawImage(skImg, 0, 0, p));
                } finally {
                    skImg.delete();
                }
            }
        }
    }

    if (obj instanceof PIXI.Container) {
        for (const child of obj.children) {
            renderDisplayObjectToPdfCanvas(ck, canvas, child);
        }
    }

    canvas.restore();
}

/** Создаёт PDF-документ через Skia PDF backend и скачивает его */
export async function exportSceneToPDF(
    ck: CanvasKit,
    container: PIXI.Container,
    width: number,
    height: number,
    filename = 'scene.pdf',
): Promise<void> {
    if (!('MakePDFDocument' in ck)) {
        console.warn('Skia PDF backend не доступен. Собери кастомный WASM с флагом skia_enable_pdf=true.');
        alert('PDF экспорт требует кастомной WASM-сборки Skia с PDF backend.\nСм. build_skia_pdf.sh или Dockerfile.skia-build в корне проекта.');
        return;
    }

    container.updateTransform();

    const ckPdf = ck as any;
    const doc = ckPdf.MakePDFDocument(width, height);
    if (!doc) throw new Error('Не удалось создать PDF документ');

    const pdfCanvas = ckPdf._pdf_beginPage(doc._docPtr, doc._width, doc._height) as Canvas;

    const bg = bgColorSkia();
    pdfCanvas.clear(ck.Color4f(bg[0], bg[1], bg[2], bg[3]));

    renderDisplayObjectToPdfCanvas(ck, pdfCanvas, container);

    ckPdf._pdf_endPage(doc._docPtr);
    ckPdf._pdf_close(doc._docPtr);
    const rawBytes = ckPdf._pdf_getData(doc._streamPtr) as Uint8Array;
    const bytes = new Uint8Array(rawBytes);

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
