import type { HitTarget } from '../types';
import { hitTestSubShape } from '../shared/geometry';

export function dispatchHitTest(
    event: PointerEvent,
    targets: HitTarget[],
    type: 'pointerdown' | 'pointerup',
    cachedRect?: DOMRect | null
): void {
    const rect = cachedRect ?? (event.target as HTMLCanvasElement).getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        const { a, b, c, d, e, f } = t.inverseMatrix;
        const localX = a * px + c * py + e;
        const localY = b * px + d * py + f;

        if (
            localX < t.localBounds.x ||
            localX > t.localBounds.x + t.localBounds.width ||
            localY < t.localBounds.y ||
            localY > t.localBounds.y + t.localBounds.height
        ) {
            continue;
        }

        let hit = false;
        for (const sub of t.subShapes) {
            if (hitTestSubShape(localX, localY, sub)) {
                hit = true;
                break;
            }
        }

        if (hit) {
            if (type === 'pointerdown') t.onPointerDown?.();
            else t.onPointerUp?.();
            break;
        }
    }
}