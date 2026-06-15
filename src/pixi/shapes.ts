import * as PIXI from 'pixi.js-legacy';
import { notifyEvent } from './scenes';

const TYPE_NAMES = ['прямоугольник', 'эллипс', 'линия', 'круг'];

/** HEX-строка из числа */
function hexColor(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
}

/** Добавляет случайную фигуру (4 типа: rect, ellipse, line, circle) в контейнер */
export function addRandomShape(container: PIXI.Container): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const x = Math.random() * 700 + 50;
    const y = Math.random() * 500 + 50;
    const color = Math.floor(Math.random() * 0xffffff);
    const type = Math.floor(Math.random() * 4);

    switch (type) {
        case 0:
            g.beginFill(color).drawRect(-40, -30, 80, 60).endFill();
            break;
        case 1:
            g.beginFill(color).drawEllipse(0, 0, 60, 35).endFill();
            break;
        case 2: {
            const ex = Math.random() * 100 - 50;
            const ey = Math.random() * 100 - 50;
            g.lineStyle(5, color, 1).moveTo(0, 0).lineTo(ex, ey);
            g.finishPoly();
            const hw = 2.5;
            g.hitArea = new PIXI.Rectangle(
                Math.min(0, ex) - hw, Math.min(0, ey) - hw,
                Math.abs(ex) + hw * 2, Math.abs(ey) + hw * 2,
            );
            break;
        }
        case 3:
            g.lineStyle(4, color, 1).drawCircle(0, 0, 40);
            g.hitArea = new PIXI.Circle(0, 0, 42);
            break;
    }

    g.position.set(x, y);
    g.angle = Math.random() * 360;
    g.eventMode = 'static';
    g.on('pointerdown', () => notifyEvent(`${hexColor(color)} ${TYPE_NAMES[type]}`, 'pointerdown'));
    g.on('pointerup', () => notifyEvent(`${hexColor(color)} ${TYPE_NAMES[type]}`, 'pointerup'));

    container.addChild(g);
    return g;
}
