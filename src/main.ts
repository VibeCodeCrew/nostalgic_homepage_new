// Nostalgic Startpage — точка входа страницы новой вкладки.
// Boot: инициализация core → темы → данные → рабочий стол → оболочка.
// OOBE-мастер, Clippy, скринсейвер, updater — Этап 5 ребилда.

import './styles/base.css';
import './styles/dialogs.css';

import { on } from './core/events';
import { notifyStorageQuota } from './core/notifications';
import { initScreenshots } from './core/screenshots';
import { initThemes } from './features/themes';
import { initDesktop, renderDesktop } from './features/desktop';
import { initTaskbar } from './features/taskbar';
import { initTray } from './features/tray';
import { initStartMenu, updateStartMenuUser } from './features/startmenu';

function runStandardInit(): void {
    // Тема (xp/macos) + фон + меню-бар/док
    initThemes();
    // DNR-правила веб-приложений — Этап 4 (initWebAppFrameRules)

    // Имя/аватар в меню «Пуск»
    updateStartMenuUser();

    // Скриншоты из chrome.storage.local → in-memory, затем рендер
    initScreenshots(() => {
        renderDesktop();
        // renderStickies — Этап 3
    });

    // Оболочка: рабочий стол, панель задач, трей, меню «Пуск»
    initDesktop();
    initTaskbar();
    initTray();       // часы запускаются здесь (updateClock каждую секунду)
    initStartMenu();

    // Этап 3: stickynotes; Этап 5: clippy, screensaver, updater (тихая проверка
    // через 5 с после старта и далее каждые 2 часа)
}

function boot(): void {
    // Уведомление о переполнении localStorage
    on('storage-quota', ({ key }) => notifyStorageQuota(key));

    // Этап 5: если первый запуск (!xp_setup_done) — initSetupOOBE(runStandardInit),
    // иначе сразу runStandardInit(). Пока OOBE не портирован — стандартный путь.
    runStandardInit();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
