// Nostalgic Startpage — точка входа страницы новой вкладки.
// Boot: инициализация core → темы → данные → рабочий стол → оболочка.
// OOBE-мастер, Clippy, скринсейвер, updater — Этап 5 ребилда.

import './styles/base.css';
import './styles/dialogs.css';
import './styles/apps.css';

import { on } from './core/events';
import { notifyStorageQuota } from './core/notifications';
import { initScreenshots } from './core/screenshots';
import { initThemes } from './features/themes';
import { initDesktop, renderDesktop } from './features/desktop';
import { initTaskbar } from './features/taskbar';
import { initTray } from './features/tray';
import { initStartMenu, updateStartMenuUser } from './features/startmenu';
import { initShortcuts } from './features/shortcuts';
import { initExplorer } from './features/explorer';
import { initSettings } from './features/settings';
import { initStickyNotes } from './features/stickynotes';
import { initShutdown } from './features/shutdown';
import { initImportExport } from './features/shortcuts/importExport';
import { initApps } from './features/apps';
import { initWebApps, initWebAppFrameRules } from './features/webapps';

function runStandardInit(): void {
    // Тема (xp/macos) + фон + меню-бар/док
    initThemes();
    // DNR-правило 9001 для веб-приложений (снятие X-Frame-Options у нашей вкладки)
    initWebAppFrameRules();

    // Имя/аватар в меню «Пуск»
    updateStartMenuUser();

    // Скриншоты из chrome.storage.local → in-memory, затем рендер
    initScreenshots(() => {
        renderDesktop();
    });

    // Оболочка: рабочий стол, панель задач, трей, меню «Пуск»
    initDesktop();
    initTaskbar();
    initTray();       // часы запускаются здесь (updateClock каждую секунду)
    initStartMenu();
    initShortcuts();  // диалоги ярлыков, скриншоты, дропы
    initExplorer();   // Мой компьютер, корзина, сведения, закладки
    initSettings();
    initStickyNotes();
    initShutdown();
    initImportExport();
    initApps();
    initWebApps();

    // Этап 5: clippy, screensaver, bsod, oobe, updater (тихая проверка через 5 с и каждые 2 ч)
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
