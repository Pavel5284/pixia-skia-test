import * as PIXI from 'pixi.js-legacy';

// Расширяем Window, чтобы TypeScript не ругался на window.logEvent
declare global {
    interface Window {
        logEvent?: (msg: string) => void;
    }
}

/**
 * Показывает тост-уведомление и пишет в лог событий на странице.
 * Дублирует console.log для наглядной демонстрации работы событий.
 */
export function notifyEvent(label: string, eventType: 'pointerdown' | 'pointerup'): void {
    const icon = eventType === 'pointerdown' ? '▼' : '▲';
    const msg = `${icon} <strong>${label}</strong>: ${eventType}`;
    console.log(`[event] ${label}: ${eventType}`);
    window.logEvent?.(msg);
    showToast(`${icon} ${label}: ${eventType}`);
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string): void {
    document.getElementById('__event-toast')?.remove();
    if (_toastTimer !== null) clearTimeout(_toastTimer);

    const toast = document.createElement('div');
    toast.id = '__event-toast';
    toast.textContent = message;
    toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 60, 0.92);
    backdrop-filter: blur(8px);
    color: #e0e0ff;
    padding: 10px 22px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.18);
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
    pointer-events: none;
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.35s;
  `;
    document.body.appendChild(toast);
    _toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, 1400);
}

// ─── Сцена 1 ────────────────────────────────────────────────────────────────

export function createScene1(): PIXI.Container {
    const mainContainer = new PIXI.Container();
    const subContainer = new PIXI.Container();

    const g1 = new PIXI.Graphics();
    const g2 = new PIXI.Graphics();
    const g3 = new PIXI.Graphics();
    const g4 = new PIXI.Graphics();

    g1.beginFill(0xff0000).drawEllipse(0, 0, 200, 100).endFill();
    g1.position.set(200, 100);
    g1.angle = 30;
    g1.eventMode = 'static';
    g1.on('pointerdown', () => notifyEvent('#ff0000 эллипс', 'pointerdown'));
    g1.on('pointerup', () => notifyEvent('#ff0000 эллипс', 'pointerup'));

    g2.beginFill(0x0000ff).drawRect(-50, -75, 100, 150).endFill();
    g2.position.set(120, 60);
    g2.angle = 15;
    g2.scale.set(1.5, 1.7);
    g2.eventMode = 'static';
    g2.on('pointerdown', () => notifyEvent('#0000ff прямоугольник', 'pointerdown'));
    g2.on('pointerup', () => notifyEvent('#0000ff прямоугольник', 'pointerup'));

    // Белая линия (без событий, только визуал)
    g3.lineStyle(10, 0xffffff, 1).moveTo(0, 0).lineTo(150, 100);
    g3.angle = -20;

    // Жёлтая линия (без событий, только визуал)
    g4.lineStyle(10, 0xffff00, 1).moveTo(0, 70).lineTo(150, -30);
    g4.angle = 20;

    subContainer.position.set(75, 50);
    subContainer.addChild(g3, g4);
    mainContainer.addChild(subContainer, g1, g2);

    return mainContainer;
}

// ─── Сцена 2 ────────────────────────────────────────────────────────────────

export function createScene2(): PIXI.Container {
    const container = new PIXI.Container();

    const g1 = new PIXI.Graphics();
    g1.beginFill(0x00ff88).drawPolygon([0, -60, 52, 30, -52, 30]).endFill();
    g1.position.set(300, 200);
    g1.eventMode = 'static';
    g1.on('pointerdown', () => notifyEvent('#00ff88 треугольник', 'pointerdown'));
    g1.on('pointerup', () => notifyEvent('#00ff88 треугольник', 'pointerup'));

    const g2 = new PIXI.Graphics();
    g2.lineStyle(6, 0xff4488, 1).drawCircle(0, 0, 80);
    g2.position.set(500, 300);
    g2.eventMode = 'static';
    g2.hitArea = new PIXI.Circle(0, 0, 83);
    g2.on('pointerdown', () => notifyEvent('#ff4488 круг', 'pointerdown'));
    g2.on('pointerup', () => notifyEvent('#ff4488 круг', 'pointerup'));

    const g3 = new PIXI.Graphics();
    g3.beginFill(0xffaa00).drawRect(0, 0, 120, 80).endFill();
    g3.position.set(50, 400);
    g3.angle = -10;
    g3.eventMode = 'static';
    g3.on('pointerdown', () => notifyEvent('#ffaa00 прямоугольник', 'pointerdown'));
    g3.on('pointerup', () => notifyEvent('#ffaa00 прямоугольник', 'pointerup'));

    container.addChild(g1, g2, g3);
    return container;
}