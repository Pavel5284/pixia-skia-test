import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Paint, Path } from 'skia';

/** Конвертирует PIXI-цвет (0xRRGGBB) и alpha в массив Skia [r, g, b, a] (0..1) */
export function pixiColorToSkia(color: number, alpha: number): number[] {
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    return [r, g, b, alpha];
}

/** Строит Skia Path из PIXI.IShape (rect, ellipse, circle, polygon, rounded-rect) */
export function buildSkiaPath(ck: CanvasKit, shape: PIXI.IShape): Path | null {
    const pb = new ck.PathBuilder();

    if (shape instanceof PIXI.Rectangle) {
        pb.addRect(ck.XYWHRect(shape.x, shape.y, shape.width, shape.height));
        return pb.detach();
    }

    if (shape instanceof PIXI.Ellipse) {
        pb.addOval(
            ck.XYWHRect(
                shape.x - shape.width,
                shape.y - shape.height,
                shape.width * 2,
                shape.height * 2,
            ),
        );
        return pb.detach();
    }

    if (shape instanceof PIXI.Circle) {
        pb.addCircle(shape.x, shape.y, shape.radius);
        return pb.detach();
    }

    if (shape instanceof PIXI.Polygon) {
        const pts = shape.points;
        if (pts.length < 4) {
            pb.delete();
            return null;
        }
        pb.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
            pb.lineTo(pts[i], pts[i + 1]);
        }
        if (shape.closeStroke) pb.close();
        return pb.detach();
    }

    {
        const rx = shape.radius;
        pb.addRRect(ck.RRectXY(ck.XYWHRect(shape.x, shape.y, shape.width, shape.height), rx, rx));
        return pb.detach();
    }
}

/** Утилита: создаёт Paint, применяет setup, вызывает fn, удаляет Paint */
export function usePaint(
    ck: CanvasKit,
    setup: (paint: Paint) => void,
    fn: (paint: Paint) => void,
): void {
    const paint = new ck.Paint();
    try {
        setup(paint);
        fn(paint);
    } finally {
        paint.delete();
    }
}
