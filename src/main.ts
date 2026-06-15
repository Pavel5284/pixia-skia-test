/// <reference types="vite/client" />
import { applyPixiPatch } from './events/pixiPatch';
applyPixiPatch();
import { loadCanvasKit } from './skia/canvaskit';
import { getPixiApp } from './pixi/app';
import { createScene1, createScene2 } from './pixi/scenes';
import { convertPixiContainerToSkia } from './skia/renderer';
import { initControls } from './ui/controls';
import { SCENE_WIDTH, SCENE_HEIGHT } from './shared/geometry';

/** Точка входа: загружает CanvasKit, создаёт Pixi/Skia канвасы и инициализирует UI */
async function main() {
    const ck = await loadCanvasKit();

    const pixiCanvas = document.getElementById('pixi-canvas');
    if (!pixiCanvas) throw new Error('Элемент #pixi-canvas не найден в DOM');
    const pixiApp = getPixiApp(pixiCanvas as HTMLCanvasElement);

    const scenes = [createScene1(), createScene2()];
    pixiApp.stage.addChild(scenes[0]);

    const skiaCanvas = document.getElementById('skia-canvas');
    if (!skiaCanvas) throw new Error('Элемент #skia-canvas не найден в DOM');
    (skiaCanvas as HTMLCanvasElement).width = SCENE_WIDTH;
    (skiaCanvas as HTMLCanvasElement).height = SCENE_HEIGHT;

    const skSurface =
        ck.MakeWebGLCanvasSurface(skiaCanvas as HTMLCanvasElement) ??
        (() => {
            console.warn('WebGL недоступен, используется Software-рендерер Skia');
            return ck.MakeSWCanvasSurface(skiaCanvas as HTMLCanvasElement);
        })();

    if (!skSurface) throw new Error('Не удалось создать Skia-поверхность');

    const skCanvas = skSurface.getCanvas();
    const hitTargets = convertPixiContainerToSkia(ck, skCanvas, scenes[0], SCENE_WIDTH, SCENE_HEIGHT);
    skSurface.flush();

    const cleanup = initControls({
        ck,
        pixiApp,
        skSurface,
        scenes,
        currentSceneIndex: 0,
        hitTargets,
        skiaCanvas: skiaCanvas as HTMLCanvasElement,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
    });

    if (import.meta.hot) {
        import.meta.hot.dispose(cleanup);
    }

    console.log('Приложение инициализировано ✓');
}

main().catch(console.error);
