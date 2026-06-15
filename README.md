# pixi-skia-app

TypeScript-приложение, объединяющее **Pixi.js** (CanvasRenderer) и **Skia** (CanvasKit WASM).  
Один и тот же `PIXI.Container` рендерится на двух канвасах рядом — через Pixi и через Skia — с поддержкой hit-test событий и экспорта в **векторный PDF** через настоящий Skia PDF backend.

---

## Быстрый старт

```bash
npm install
npm run dev        # http://localhost:3000
```

> **Внимание:** для работы кнопки «Экспорт в PDF» нужна кастомная WASM-сборка.  
> Без неё Skia-канвас работает, PDF — нет.  
> Инструкция по сборке ниже.

---

## Функциональность

| Возможность | Статус |
|---|---|
| Рендеринг PIXI.Container через Skia CanvasKit | ✅ |
| Трансформации: translate, rotate, scale | ✅ |
| PIXI.Graphics: rect, ellipse, circle, polygon, line | ✅ |
| PIXI.Sprite как bitmap | ✅ |
| `pointerdown` / `pointerup` на Skia-канвасе (hit-test через обратную матрицу) | ✅ |
| `pointerdown` / `pointerup` на Pixi-канвасе (нативные события через EventSystem + hitArea) | ✅ |
| Клик на stroke-only фигуры (круг без fill, линия) на обоих канвасах | ✅ |
| Случайная фигура (4 типа, случайный цвет) | ✅ |
| Переключение сцен | ✅ |
| Экспорт в PDF (Skia PDF backend, кастомный WASM) | ✅ после сборки |

---

## Архитектура

Две панели рядом (`index.html:133-144`):

```
┌─────────────────────┐  ┌─────────────────────┐
│  Pixi.js (forceCanvas│  │  Skia (CanvasKit)    │
│  canvas#pixi-canvas  │  │  canvas#skia-canvas  │
│                      │  │                      │
│  PIXI.Application    │  │  CanvasKit WASM      │
│  EventSystem         │  │  dispatchHitTest()   │
│  containsPoint       │  │  hitTargets[]        │
│  hitArea             │  │  pointInShapeExpanded│
└─────────────────────┘  └─────────────────────┘
```

### Pixi-канвас
- Штатный `PIXI.Application` с `forceCanvas: true` (CanvasRenderer).
- `EventSystem` обрабатывает pointer-события и вызывает `containsPoint` на фигурах.
- Для stroke-only фигур (круг без fill, линия) установлен `hitArea`, т.к. `Graphics.containsPoint` в PIXI v7 не учитывает stroke.

### Skia-канвас
- CanvasKit рендерит тот же PIXI.Container через Skia.
- Hit-test через массив `hitTargets[]`, построенный из `graphicsData` с учётом `worldTransform`.
- Для stroke-only фигур используется `pointInShapeExpanded` — проверка попадания с отступом `lineWidth / 2`.

---

## Сборка кастомного WASM с PDF backend

### Требования

- Linux x86_64 (Ubuntu 20.04+ / Debian 11+)
- Python 3.8+
- Git
- Ninja: `sudo apt install ninja-build`
- Свободного места: ~5 GB (исходники Skia + emsdk)
- Время: 20–60 минут

### Шаги

```bash
chmod +x build_skia_pdf.sh
./build_skia_pdf.sh /path/to/this/project
```

После сборки артефакты в `libs/skia/`:
- `canvaskit.js` — кастомная JS-обёртка (ESM)
- `canvaskit.wasm` — кастомный WASM с PDF backend (9.1 MB)
- `index.d.ts` — TypeScript типы

---

## Структура проекта

```
├── libs/skia/                ← кастомная WASM-сборка (после сборки)
│   ├── canvaskit.js
│   ├── canvaskit.wasm
│   └── index.d.ts
├── public/canvaskit/         ← canvaskit.wasm для браузера (/canvaskit/)
├── src/
│   ├── events/
│   │   ├── hitTest.ts        ← hit-test через обратную матрицу
│   │   └── pixiPatch.ts      ← патч containsPoint для stroke (запасной)
│   ├── pixi/
│   │   ├── app.ts            ← PIXI.Application singleton
│   │   ├── scenes.ts         ← createScene1, createScene2
│   │   └── shapes.ts         ← addRandomShape
│   ├── shared/
│   │   ├── geometry.ts       ← hit-test math (pointInShape, pointInShapeExpanded)
│   │   └── skia-utils.ts     ← общие Skia-функции (pixiColorToSkia, buildSkiaPath, usePaint)
│   ├── skia/
│   │   ├── canvaskit.ts      ← loadCanvasKit()
│   │   ├── pdfExporter.ts    ← exportSceneToPDF() через SkPDF backend
│   │   └── renderer.ts       ← convertPixiContainerToSkia()
│   ├── types/
│   │   └── index.ts          ← HitTarget, SubShape, ShapeInfo, ShapeType
│   └── ui/
│       └── controls.ts       ← кнопки, переключение сцен, syncSkiaCanvas
├── build_skia_pdf.sh         ← скрипт Docker-сборки кастомного WASM
├── Dockerfile.skia-build     ← Docker-образ для сборки
├── vite.config.ts
├── package.json
└── index.html
```

---

## Технологии

- [TypeScript](https://www.typescriptlang.org/) 5.4+
- [Pixi.js legacy](https://pixijs.com/) 7.2.4 (`forceCanvas: true`)
- [Skia / CanvasKit](https://skia.org/docs/user/modules/canvaskit/) — кастомная WASM-сборка
- [Vite](https://vitejs.dev/) 8.x
