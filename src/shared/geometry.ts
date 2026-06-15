import * as PIXI from 'pixi.js-legacy';
import type { ShapeInfo, SubShape } from '../types';

export const SCENE_WIDTH = 800;
export const SCENE_HEIGHT = 600;
const BG_COLOR = 0x1a1a2e;

export const BG_COLOR_PIXI: number = BG_COLOR;

export function bgColorSkia(): [number, number, number, number] {
    return [
        ((BG_COLOR >> 16) & 0xff) / 255,
        ((BG_COLOR >> 8) & 0xff) / 255,
        (BG_COLOR & 0xff) / 255,
        1.0,
    ];
}

export function bgColorJsPdf(): [number, number, number] {
    return [(BG_COLOR >> 16) & 0xff, (BG_COLOR >> 8) & 0xff, BG_COLOR & 0xff];
}

export interface GraphicsDataItem {
    shape: PIXI.IShape;
    lineStyle: { visible: boolean; width: number; color: number; alpha: number } | null;
    fillStyle: { visible: boolean; color: number; alpha: number } | null;
}

export function getGraphicsData(g: PIXI.Graphics): ReadonlyArray<GraphicsDataItem> {
    const gd = (g.geometry as unknown as { graphicsData?: ReadonlyArray<unknown> }).graphicsData;
    if (!gd) return [];
    return gd as ReadonlyArray<GraphicsDataItem>;
}

export function getSpriteSource(
    sprite: PIXI.Sprite,
): HTMLImageElement | HTMLCanvasElement | undefined {
    const res = sprite.texture?.baseTexture?.resource as
        | { source?: HTMLImageElement | HTMLCanvasElement }
        | undefined;
    return res?.source;
}

export function pixiMatrixToDOMMatrix(wt: PIXI.Matrix): DOMMatrix {
    return new DOMMatrix([wt.a, wt.b, wt.c, wt.d, wt.tx, wt.ty]);
}

export function buildShapeInfo(shape: PIXI.IShape): ShapeInfo | null {
    if (shape instanceof PIXI.Circle) {
        return { type: 'circle', cx: shape.x, cy: shape.y, radius: shape.radius };
    }
    if (shape instanceof PIXI.Ellipse) {
        return { type: 'ellipse', cx: shape.x, cy: shape.y, rx: shape.width, ry: shape.height };
    }
    if (shape instanceof PIXI.Rectangle) {
        return { type: 'rect', x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    }
    if (shape instanceof PIXI.RoundedRectangle) {
        return {
            type: 'rounded-rect',
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            cornerRadius: shape.radius,
        };
    }
    {
        const pts = shape.points;
        const closeStroke = (shape as PIXI.Polygon).closeStroke;
        if (!closeStroke && pts.length === 4) {
            return { type: 'line', points: [pts[0], pts[1], pts[2], pts[3]] };
        }
        return { type: 'polygon', points: [...pts], closeStroke: closeStroke ?? true };
    }
}

export function buildSubShape(data: GraphicsDataItem): SubShape | null {
    const shapeInfo = buildShapeInfo(data.shape);
    if (!shapeInfo) return null;
    return {
        shape: shapeInfo,
        lineWidth: data.lineStyle?.width ?? 0,
        hasStroke: !!(
            data.lineStyle?.visible &&
            data.lineStyle.width > 0 &&
            data.lineStyle.alpha > 0
        ),
        hasFill: !!(data.fillStyle?.visible && data.fillStyle.alpha > 0),
    };
}

function pointInPolygon(px: number, py: number, pts: number[]): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
        const xi = pts[i],
            yi = pts[i + 1];
        const xj = pts[j],
            yj = pts[j + 1];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

export function pointInShape(px: number, py: number, shape: ShapeInfo): boolean {
    switch (shape.type) {
        case 'circle': {
            const dx = px - shape.cx,
                dy = py - shape.cy;
            return dx * dx + dy * dy <= shape.radius * shape.radius;
        }
        case 'ellipse': {
            const dx = (px - shape.cx) / shape.rx,
                dy = (py - shape.cy) / shape.ry;
            return dx * dx + dy * dy <= 1;
        }
        case 'rect':
            return (
                px >= shape.x &&
                px <= shape.x + shape.width &&
                py >= shape.y &&
                py <= shape.y + shape.height
            );
        case 'rounded-rect':
            return pointInRoundedRect(px, py, shape);
        case 'polygon':
            return pointInPolygon(px, py, shape.points);
        case 'line':
            return false;
    }
}

function pointInRoundedRect(
    px: number,
    py: number,
    shape: ShapeInfo & { type: 'rounded-rect' },
): boolean {
    const { x, y, width: w, height: h, cornerRadius: r } = shape;

    // Точка вне AABB — сразу промах
    if (px < x || px > x + w || py < y || py > y + h) return false;

    const cr = Math.min(r, Math.min(w, h) / 2);

    // Описываем четыре угловых зоны: [x1, y1, x2, y2, cx, cy]
    // cx/cy — центр окружности скругления для данного угла
    const corners: [number, number, number, number, number, number][] = [
        [x,           y,           x + cr,     y + cr,     x + cr,     y + cr    ], // верхний левый
        [x + w - cr,  y,           x + w,      y + cr,     x + w - cr, y + cr    ], // верхний правый
        [x,           y + h - cr,  x + cr,     y + h,      x + cr,     y + h - cr], // нижний левый
        [x + w - cr,  y + h - cr,  x + w,      y + h,      x + w - cr, y + h - cr], // нижний правый
    ];

    for (const [x1, y1, x2, y2, cx, cy] of corners) {
        if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
            // Точка в угловой зоне — проверяем попадание в круг скругления
            const dx = px - cx,
                dy = py - cy;
            return dx * dx + dy * dy <= cr * cr;
        }
    }

    // Точка вне угловых зон, но внутри AABB — попадание
    return true;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInShapeExpanded(px: number, py: number, shape: ShapeInfo, margin: number): boolean {
    switch (shape.type) {
        case 'circle': {
            const r = shape.radius + margin;
            const dx = px - shape.cx, dy = py - shape.cy;
            return dx * dx + dy * dy <= r * r;
        }
        case 'ellipse': {
            const rx = shape.rx + margin, ry = shape.ry + margin;
            const dx = (px - shape.cx) / rx, dy = (py - shape.cy) / ry;
            return dx * dx + dy * dy <= 1;
        }
        case 'rect':
            return (
                px >= shape.x - margin && px <= shape.x + shape.width + margin &&
                py >= shape.y - margin && py <= shape.y + shape.height + margin
            );
        case 'rounded-rect':
            return (
                px >= shape.x - margin && px <= shape.x + shape.width + margin &&
                py >= shape.y - margin && py <= shape.y + shape.height + margin
            );
        case 'polygon':
            return pointInPolygon(px, py, shape.points);
        case 'line': {
            const pts = shape.points;
            let best = Infinity;
            for (let i = 2; i < pts.length; i += 2) {
                const d = distToSegment(px, py, pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
                if (d < best) best = d;
            }
            return best <= margin;
        }
    }
}

export function hitTestSubShape(px: number, py: number, sub: SubShape): boolean {
    return (sub.hasFill && pointInShape(px, py, sub.shape)) ||
        (sub.hasStroke && pointInShapeExpanded(px, py, sub.shape, sub.lineWidth / 2));
}