import * as PIXI from 'pixi.js-legacy';

function distToSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number,
): number {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointOnStroke(
    px: number, py: number,
    shape: PIXI.IShape,
    halfWidth: number,
): boolean {
    if (shape instanceof PIXI.Circle) {
        const dx = px - shape.x, dy = py - shape.y;
        return Math.abs(Math.sqrt(dx * dx + dy * dy) - shape.radius) <= halfWidth;
    }
    if (shape instanceof PIXI.Ellipse) {
        const dx = (px - shape.x) / (shape.width + halfWidth);
        const dy = (py - shape.y) / (shape.height + halfWidth);
        return dx * dx + dy * dy <= 1;
    }
    if (shape instanceof PIXI.Rectangle) {
        const left = shape.x, right = shape.x + shape.width;
        const top = shape.y, bottom = shape.y + shape.height;
        const dx = Math.max(left - px, 0, px - right);
        const dy = Math.max(top - py, 0, py - bottom);
        return dx * dx + dy * dy <= halfWidth * halfWidth;
    }
    if (shape instanceof PIXI.RoundedRectangle) {
        const left = shape.x, right = shape.x + shape.width;
        const top = shape.y, bottom = shape.y + shape.height;
        const dx = Math.max(left - px, 0, px - right);
        const dy = Math.max(top - py, 0, py - bottom);
        return dx * dx + dy * dy <= halfWidth * halfWidth;
    }
    {
        const pts = shape.points;
        for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
            if (distToSegment(px, py, pts[j], pts[j + 1], pts[i], pts[i + 1]) <= halfWidth) {
                return true;
            }
        }
        return false;
    }
}

export function applyPixiPatch(): void {
    const origContainsPoint = PIXI.Graphics.prototype.containsPoint;

    PIXI.Graphics.prototype.containsPoint = function (point: { x: number; y: number }): boolean {
        (this as any).finishPoly?.();
        try {
            if (origContainsPoint.call(this, point)) return true;
        } catch {
            // Ignore — вероятно нет fillStyle
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        let gd: ReadonlyArray<any> | undefined;

        if (self.geometry?.graphicsData) {
            gd = self.geometry.graphicsData;
        } else if (self.graphicsData) {
            gd = self.graphicsData;
        } else if (self._graphicsData) {
            gd = self._graphicsData;
        } else if (self._geometry?._graphicsData) {
            gd = self._geometry._graphicsData;
        }

        if (!gd) return false;

        for (const data of gd) {
            if (data.lineStyle?.visible && data.lineStyle.width > 0 && data.shape) {
                if (pointOnStroke(point.x, point.y, data.shape, data.lineStyle.width / 2)) {
                    return true;
                }
            }
        }
        return false;
    };
}
