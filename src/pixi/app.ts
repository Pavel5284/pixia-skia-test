import * as PIXI from 'pixi.js-legacy';
import { SCENE_WIDTH, SCENE_HEIGHT, BG_COLOR_PIXI } from '../shared/geometry';

/** Singleton-инстанс PIXI.Application */
let _app: PIXI.Application | null = null;

/** Создаёт или возвращает существующий PIXI.Application с forceCanvas: true */
export function getPixiApp(canvas: HTMLCanvasElement): PIXI.Application {
    if (_app) return _app;

    _app = new PIXI.Application({
        view: canvas,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        backgroundColor: BG_COLOR_PIXI,
        forceCanvas: true,
        antialias: true,
    });

    return _app;
}
