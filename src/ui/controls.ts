import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Surface as SkSurface } from 'skia';
import { addRandomShape } from '../pixi/shapes';
import { convertPixiContainerToSkia } from '../skia/renderer';
import { exportSceneToPDF } from '../skia/pdfExporter';
import { dispatchHitTest } from '../events/hitTest';
import type { HitTarget } from '../types';

interface AppState {
    ck: CanvasKit;
    pixiApp: PIXI.Application;
    skSurface: SkSurface;
    /** Все сцены создаются один раз в main.ts и передаются сюда */
    scenes: PIXI.Container[];
    currentSceneIndex: number;
    hitTargets: HitTarget[];
    skiaCanvas: HTMLCanvasElement;
    width: number;
    height: number;
}

function syncSkiaCanvas(state: AppState): void {
    const skCanvas = state.skSurface.getCanvas();
    state.hitTargets = convertPixiContainerToSkia(
        state.ck,
        skCanvas,
        state.scenes[state.currentSceneIndex],
        state.width,
        state.height,
    );
    state.skSurface.flush();
}

export function initControls(state: AppState): () => void {
    let cachedRect: DOMRect | null = null;

    function getSkiaRect(): DOMRect {
        if (!cachedRect) cachedRect = state.skiaCanvas.getBoundingClientRect();
        return cachedRect;
    }

    const invalidateRect = () => {
        cachedRect = null;
    };

    // Инвалидируем кэш при изменении размеров окна и при скролле
    window.addEventListener('resize', invalidateRect);
    window.addEventListener('scroll', invalidateRect, true);

    const onAddShape = () => {
        addRandomShape(state.scenes[state.currentSceneIndex]);
        syncSkiaCanvas(state);
    };

    const onExportPdf = () => {
        exportSceneToPDF(
            state.ck,
            state.scenes[state.currentSceneIndex],
            state.width,
            state.height,
        ).catch((err: unknown) => {
            console.error('Ошибка экспорта PDF:', err);
            alert('Не удалось экспортировать PDF. Подробности в консоли.');
        });
    };

    const switchScene = (delta: 1 | -1) => {
        state.currentSceneIndex =
            (state.currentSceneIndex + delta + state.scenes.length) % state.scenes.length;
        state.pixiApp.stage.removeChildren();
        state.pixiApp.stage.addChild(state.scenes[state.currentSceneIndex]);
        syncSkiaCanvas(state);
    };

    const onPrevScene = () => switchScene(-1);
    const onNextScene = () => switchScene(1);

    const onPointerDown = (e: PointerEvent) =>
        dispatchHitTest(e, state.hitTargets, 'pointerdown', getSkiaRect());
    const onPointerUp = (e: PointerEvent) =>
        dispatchHitTest(e, state.hitTargets, 'pointerup', getSkiaRect());

    const btnAddShape = document.getElementById('btn-add-shape');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnPrevScene = document.getElementById('btn-prev-scene');
    const btnNextScene = document.getElementById('btn-next-scene');

    if (!btnAddShape) console.warn('Кнопка #btn-add-shape не найдена в DOM');
    if (!btnExportPdf) console.warn('Кнопка #btn-export-pdf не найдена в DOM');
    if (!btnPrevScene) console.warn('Кнопка #btn-prev-scene не найдена в DOM');
    if (!btnNextScene) console.warn('Кнопка #btn-next-scene не найдена в DOM');

    btnAddShape?.addEventListener('click', onAddShape);
    btnExportPdf?.addEventListener('click', onExportPdf);
    btnPrevScene?.addEventListener('click', onPrevScene);
    btnNextScene?.addEventListener('click', onNextScene);
    state.skiaCanvas.addEventListener('pointerdown', onPointerDown);
    state.skiaCanvas.addEventListener('pointerup', onPointerUp);

    return function cleanup() {
        window.removeEventListener('resize', invalidateRect);
        window.removeEventListener('scroll', invalidateRect, true);
        btnAddShape?.removeEventListener('click', onAddShape);
        btnExportPdf?.removeEventListener('click', onExportPdf);
        btnPrevScene?.removeEventListener('click', onPrevScene);
        btnNextScene?.removeEventListener('click', onNextScene);
        state.skiaCanvas.removeEventListener('pointerdown', onPointerDown);
        state.skiaCanvas.removeEventListener('pointerup', onPointerUp);
    };
}