import type { CanvasKit, Canvas, Paint, Path } from 'skia';

/** Цель для hit-test: описывает позицию, трансформацию, subShapes и колбэки событий */
export interface HitTarget {
    localBounds: DOMRect;
    worldMatrix: DOMMatrix;
    inverseMatrix: DOMMatrix;
    subShapes: SubShape[];
    onPointerDown?: () => void;
    onPointerUp?: () => void;
}

/** Одна подобласть фигуры с информацией о fill/stroke */
export interface SubShape {
    shape: ShapeInfo;
    lineWidth: number;
    hasStroke: boolean;
    hasFill: boolean;
}

/** Унифицированное описание геометрической фигуры для hit-test и рендера */
export type ShapeInfo =
    | { type: 'circle'; cx: number; cy: number; radius: number }
    | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
    | { type: 'rect'; x: number; y: number; width: number; height: number }
    | { type: 'rounded-rect'; x: number; y: number; width: number; height: number; cornerRadius: number }
    | { type: 'polygon'; points: number[]; closeStroke: boolean }
    | { type: 'line'; points: number[] };

export type { CanvasKit, Canvas, Paint, Path };
