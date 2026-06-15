import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Canvas } from 'skia';
import type { HitTarget, SubShape } from '../types';
import {
    getGraphicsData,
    getSpriteSource,
    buildSubShape,
    bgColorSkia,
    pixiMatrixToDOMMatrix,
} from '../shared/geometry';
import { pixiColorToSkia, buildSkiaPath, usePaint } from '../shared/skia-utils';

/** Рекурсивно обходит PIXI.DisplayObject и рисует его на Skia-канвасе */
export function renderDisplayObject(
    ck: CanvasKit,
    skCanvas: Canvas,
    obj: PIXI.DisplayObject,
    hitTargets: HitTarget[],
): void {
    if (!obj.visible || obj.worldAlpha <= 0) return;

    skCanvas.save();

    const { x, y } = obj.position;
    const { x: sx, y: sy } = obj.scale;
    const rad = obj.rotation;

    skCanvas.translate(x, y);
    skCanvas.rotate(rad * (180 / Math.PI), 0, 0);
    skCanvas.scale(sx, sy);

    if (obj instanceof PIXI.Graphics) {
        obj.finishPoly();
        const graphicsData = getGraphicsData(obj);
        const subShapes: SubShape[] = [];

        for (const data of graphicsData) {
            const { shape, lineStyle, fillStyle } = data;
            const skPath = buildSkiaPath(ck, shape);
            if (!skPath) continue;

            const sub = buildSubShape(data);
            if (sub) subShapes.push(sub);

            try {
                if (fillStyle?.visible && fillStyle.alpha > 0) {
                    usePaint(
                        ck,
                        (p) => {
                            p.setStyle(ck.PaintStyle.Fill);
                            p.setColor(pixiColorToSkia(fillStyle.color, fillStyle.alpha));
                            p.setAntiAlias(true);
                        },
                        (p) => skCanvas.drawPath(skPath, p),
                    );
                }

                if (lineStyle?.visible && lineStyle.width > 0 && lineStyle.alpha > 0) {
                    usePaint(
                        ck,
                        (p) => {
                            p.setStyle(ck.PaintStyle.Stroke);
                            p.setColor(pixiColorToSkia(lineStyle.color, lineStyle.alpha));
                            p.setStrokeWidth(lineStyle.width);
                            p.setAntiAlias(true);
                        },
                        (p) => skCanvas.drawPath(skPath, p),
                    );
                }
            } finally {
                skPath.delete();
            }
        }

        if (subShapes.length > 0) {
            const localBounds = obj.getLocalBounds();
            const wt = pixiMatrixToDOMMatrix(obj.worldTransform);
            hitTargets.push({
                localBounds: new DOMRect(
                    localBounds.x,
                    localBounds.y,
                    localBounds.width,
                    localBounds.height,
                ),
                worldMatrix: wt,
                inverseMatrix: wt.inverse(),
                subShapes,
                onPointerDown: () => (obj as unknown as PIXI.utils.EventEmitter).emit('pointerdown'),
                onPointerUp: () => (obj as unknown as PIXI.utils.EventEmitter).emit('pointerup'),
            });
        }
    }

    if (obj instanceof PIXI.Sprite && obj.texture?.baseTexture) {
        const img = getSpriteSource(obj);
        if (img) {
            const skImg = ck.MakeImageFromCanvasImageSource(img);
            if (skImg) {
                try {
                    usePaint(
                        ck,
                        (p) => p.setAlphaf(obj.worldAlpha),
                        (p) => skCanvas.drawImage(skImg, 0, 0, p),
                    );
                } finally {
                    skImg.delete();
                }
            }
        }

        const sw = obj.width || obj.texture.width;
        const sh = obj.height || obj.texture.height;
        if (sw > 0 && sh > 0) {
            const localBounds = obj.getLocalBounds();
            const wt = pixiMatrixToDOMMatrix(obj.worldTransform);
            hitTargets.push({
                localBounds: new DOMRect(localBounds.x, localBounds.y, localBounds.width, localBounds.height),
                worldMatrix: wt,
                inverseMatrix: wt.inverse(),
                subShapes: [{
                    shape: { type: 'rect', x: 0, y: 0, width: sw, height: sh },
                    lineWidth: 0,
                    hasStroke: false,
                    hasFill: true,
                }],
                onPointerDown: () => (obj as unknown as PIXI.utils.EventEmitter).emit('pointerdown'),
                onPointerUp: () => (obj as unknown as PIXI.utils.EventEmitter).emit('pointerup'),
            });
        }
    }

    if (obj instanceof PIXI.Container) {
        for (const child of obj.children) {
            renderDisplayObject(ck, skCanvas, child, hitTargets);
        }
    }

    skCanvas.restore();
}

/** Рендерит PIXI.Container на Skia-канвасе и возвращает hitTargets для событий */
export function convertPixiContainerToSkia(
    ck: CanvasKit,
    skCanvas: Canvas,
    container: PIXI.Container,
    width: number,
    height: number,
): HitTarget[] {
    container.updateTransform();

    const bg = bgColorSkia();
    skCanvas.clear(ck.Color4f(bg[0], bg[1], bg[2], bg[3]));

    const hitTargets: HitTarget[] = [];
    renderDisplayObject(ck, skCanvas, container, hitTargets);

    return hitTargets;
}
