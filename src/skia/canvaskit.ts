import CanvasKitInit from 'skia';
import type { CanvasKit } from 'skia';

/** Singleton-инстанс CanvasKit */
let _ck: CanvasKit | null = null;

/** Загружает CanvasKit WASM (кастомная сборка из libs/skia/) с поддержкой PDF */
export async function loadCanvasKit(): Promise<CanvasKit> {
    if (_ck) return _ck;

    try {
        _ck = await CanvasKitInit({
            locateFile: (file: string) => `${import.meta.env.BASE_URL}canvaskit/${file}`,
        });
        return _ck;
    } catch (err) {
        _ck = null;
        console.error('Ошибка загрузки CanvasKit WASM:', err);
        throw new Error(
            'Не удалось загрузить CanvasKit WASM. Проверьте, что canvaskit.wasm доступен по пути /canvaskit/canvaskit.wasm',
        );
    }
}
