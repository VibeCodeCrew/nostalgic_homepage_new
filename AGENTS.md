# AGENTS.md — Nostalgic Startpage (модульный ребилд)

> Файл для ИИ-агентов, работающих с проектом. Технический обзор, архитектура, соглашения, ловушки.

## 1. Обзор

Браузерное расширение (Chrome/Edge, Manifest V3): новая вкладка = интерактивный рабочий стол Windows XP (+ тема Mac OS X Aqua). Ребилд оригинального монолита (script.js 8839 строк) в модульную feature-oriented архитектуру: **TypeScript + Vite**, функциональный паритет 1:1.

**Ключевой инвариант паритета:** ключи хранилищ (`edge_*`, `xp_*`, `doom_*`, `ss_<url>`) и DOM-классы/id не менялись — данные пользователей оригинала подхватываются без миграции.

## 2. Стек и сборка

- TypeScript (strict) + Vite 7, vitest для тестов. Без UI-фреймворков, DOM строится программно.
- `npm run build` = `vite build` (страница: index.html + src/main.ts + CSS → `dist/`) + `vite build --config vite.bg.config.ts` (service worker src/background/index.ts → `dist/background.js`, ES-модуль).
- `dist/` — готовое unpacked-расширение (манифест и ассеты копируются из `public/`).
- `npm test`, `npm run typecheck` — обязательно зелёные перед коммитом.

## 3. Структура

```
├── index.html            # шаблон Vite: статическая разметка (таскбар, меню Пуск, OOBE)
├── public/               # копируется в dist verbatim: manifest.json, icons/, avatars/, wprs/, doom/, pinball/
├── src/
│   ├── main.ts           # boot: OOBE-гейт (xp_setup_done) → runStandardInit (порядок init'ов важен)
│   ├── core/             # инфраструктура, НЕ знает о фичах:
│   │   ├── types.ts      #   LinkItem, Settings, ContextMenuItem, App...
│   │   ├── keys.ts       #   ВСЕ ключи хранилищ — единственное место (контракт паритета!)
│   │   ├── store.ts      #   safeParse/getInt/getBool/setItem (защита от квоты) — все localStorage только здесь
│   │   ├── state.ts      #   links, settings, trashedLinks, username, выделение; saveLinks/saveTrash/updateSetting
│   │   ├── events.ts     #   event-bus (EventMap) — межфичевая связь без глобалов
│   │   ├── actions.ts    #   командный реестр registerAction/runAction + константы ACTION
│   │   ├── dom.ts        #   el(), escapeHtml() (ОБЯЗАТЕЛЬНО для пользовательских строк), xpIconHtml, getFaviconUrl
│   │   ├── grid.ts       #   каноническая сетка snapPos/getSnap/GRID_MARGIN — единственная на проект
│   │   ├── drag.ts       #   startDocDrag/makeDraggable — общий паттерн drag'а
│   │   ├── debounce.ts   #   debounce/throttle/rafThrottle
│   │   ├── sound.ts      #   WebAudio-синтез (playSound, громкость edge_volume)
│   │   ├── url.ts        #   isSafeUrl/normalizeUrl — whitelist http/https
│   │   ├── screenshots.ts#   chrome.storage.local: скриншоты ss_<url>, миграция блобов (фон/аватар)
│   │   └── notifications.ts # баллуны уведомлений
│   ├── wm/windowManager.ts # оконный менеджер: wmCreate/wmClose/wmMinimize/wmMaximize/wmFocus,
│   │                       #   z-order, кнопки таскбара, геометрия xp_window_geom (debounced), onClose-хук
│   ├── background/index.ts # service worker: capture_screenshot / fetch_page_title / fetch_suggestions,
│   │                       #   кнопка тулбара, яндекс-редирект (по отсутствию chrome_url_overrides)
│   └── features/         # фичи; каждая — index.ts с init*() + свой .css (импорт из index.ts)
│       ├── desktop/      #   renderDesktop (3 режима), positioning, dragDrop, selection (marquee),
│       │                 #   glassGrid, systemIcons, tileWindows, folderWindow, searchWidget, autocomplete
│       ├── contextmenu/  #   движок (index.ts) + определения и глобальный роутер (menus.ts)
│       ├── themes/       #   applyTheme, mac-менюбар, Dock (fish-eye), фон рабочего стола
│       ├── shortcuts/    #   диалоги ярлыков/папок, скриншоты, вставка, дропы, import/export
│       ├── explorer/     #   Мой компьютер, Мои ярлыки (C:), закладки (D:), Корзина, Сведения
│       ├── startmenu/    #   меню Пуск, All Programs, avatarPicker, поиск, «Выполнить», диспетчер задач
│       ├── taskbar/ tray/ settings/ stickynotes/ shutdown/
│       ├── webapps/      #   IE6-окна, updateTabIdentity, DNR-правило 9001
│       ├── screensaver/ bsod/ oobe/ updater/ clippy/   # clippy/phrases.ts — база фраз (1682 строки)
│       └── apps/         #   notepad, wordpad, paint, calculator, cmd, minesweeper, solitaire,
│                         #   hearts, pinball (лаунчер), doom (лаунчер); apps/index.ts — центральный init
└── tests/                # vitest, node-окружение (window/localStorage стабятся в тесте)
```

`doom/` и `pinball/` в `public/` — самодостаточные iframe-приложения, копия оригинала без изменений (лаунчеры — в `features/apps/`).

## 4. Архитектурные правила (обязательные)

1. **Никаких глобалов на window.** Состояние — в core/state; связь между фичами — через `core/events` (on/emit) и `core/actions` (registerAction/runAction с payload).
2. **Все обращения к localStorage — через core/store** (safeParse/setItem с защитой от квоты). Ключи — только из core/keys (там контракт паритета, новые ключи добавлять туда).
3. **escapeHtml** для любых пользовательских/сайтовых строк в innerHTML (имена ярлыков, заголовки страниц, пункты меню). Аудит оригинала нашёл XSS через label контекстного меню — не регрессировать.
4. **Каноническая сетка** — только snapPos()/getSnap() из core/grid; локальных `Math.round(x/s)*s` быть не должно.
5. **Каждое приложение** экспортирует `init<X>()` → `registerAction('app:<id>', open<X>)`, подключается в `features/apps/index.ts`. Таймеры/слушатели очищаются в `wmGet(id).onClose`.
6. **CSS** — модульный по фичам (импорт из index.ts фичи), вербатим-порт оригинала. Общее: `src/styles/base.css` (reset+переменные), `dialogs.css`, `apps.css` — подключены в main.ts.
7. Русские комментарии, 4 пробела, одинарные кавычки, strict TS.
8. **chrome.* вызовы** — с проверкой `chrome.runtime.lastError` / guard'ами.

## 5. Жизненный цикл (main.ts)

`boot()` → `storage-quota` подписка → если `!isSetupDone()` — `initSetupOOBE(runStandardInit)`, иначе сразу `runStandardInit()`:
initThemes (+ миграция фона) → initWebAppFrameRules → initOOBEGrids → updateStartMenuUser → initScreenshots(cb: renderDesktop) → initDesktop/Taskbar/Tray/StartMenu/Shortcuts/Explorer/Settings/StickyNotes/Shutdown/ImportExport/Apps/WebApps → initScreensaver/Bsod/Hotkeys/Clippy/Updater (тихая проверка через 5с + каждые 2ч).

## 6. Ловушки (наследие оригинала — не «чинить»)

- **`startup.mp3` не существует** — звук запуска синтезируется WebAudio (playSound('startup')). Так задумано.
- **Сейвы DOOM** (`doom_saves_v2`) и общий localStorage origin расширения разделяют index.html и iframe doom/ — не ломать ключи.
- **DNR-правило 9001** (webapps) снимает X-Frame-Options/CSP у sub_frame текущей вкладки — осознанный трейдофф, задокументирован.
- **CSP** манифеста: `'wasm-unsafe-eval'` обязателен для DOOM; `minimum_chrome_version: "102"`.
- **4 аватара** из списка AVATARS отсутствуют на диске (dirt bike, palm tree, pink flower, red flower) — img.onerror скрывает пункт, как в оригинале.
- **Калькулятор**: кнопка x^y в оригинале без обработчика — сохранено для паритета.
- **renderDesktop** — полный ребилд DOM; из слайдеров вызывать через renderDesktopDebounced. НЕ подписывать renderDesktop на 'links-changed' (drag пишет saveLinks без перерисовки — флаг _wasDragged на DOM-элементе).
- **Смена viewMode** — реакция через подписку на 'settings-changed' в desktop, а не точечными вызовами renderDesktop.

## 7. Осознанные отличия от оригинала (фиксы аудита)

safeParse при старте; escapeHtml в контекстных меню; фон/аватар в chrome.storage.local (маркер 'custom'); whitelist URL при импорте (javascript: удаляется); debounce на слайдерах/стикерах/истории; onClose-очистка таймеров приложений; destroy() автокомплита; rAF-throttle marquee/дока/зрачков; манифест +icons/action/minimum_chrome_version/description. Мёртвые файлы оригинала (jsdos, websockets-doom, дубликат doom1.wad, Sequoia.jpg) не перенесены.

## 8. Бэклог (не входило в ребилд)

- Адаптивность CSS (0 медиазапросов в оригинале), доступность (tabindex/роли).
- Оптимизация веса ассетов (WiXP.jpg 2 МБ, pinball/title.png, avatars BMP→PNG/WebP).
- Яндекс-сборка под новую структуру (sync-yandex аналог).
- CI релизов, больше тестов.
