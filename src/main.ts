// Nostalgic Startpage — точка входа страницы новой вкладки.
// Boot: OOBE при первом запуске → стандартная инициализация.

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
import { initScreensaver } from './features/screensaver';
import { initBsod } from './features/bsod';
import { initHotkeys } from './features/bsod/hotkeys';
import { initUpdater } from './features/updater';
import { initClippy } from './features/clippy';
import { initSetupOOBE, isSetupDone, initOOBEGrids } from './features/oobe';

function runStandardInit(): void {
    // Тема (xp/macos) + фон + меню-бар/док (+ миграция dataURL-фона в chrome.storage)
    initThemes();
    // DNR-правило 9001 для веб-приложений (снятие X-Frame-Options у нашей вкладки)
    initWebAppFrameRules();

    // Сетки аватаров (OOBE и диалог выбора) генерируются из одного массива
    initOOBEGrids();
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

    // Фон и метагейм
    initScreensaver();
    initBsod();       // действие 'bsod' + пасхалка (5 кликов по часам)
    initHotkeys();    // Ctrl+Alt+R, Ctrl+Shift+Esc, Ctrl+V, Delete, Escape
    initClippy();
    initUpdater();    // тихая проверка через 5 с после старта и далее каждые 2 часа
}

function boot(): void {
    // Уведомление о переполнении localStorage
    on('storage-quota', ({ key }) => notifyStorageQuota(key));

    if (!isSetupDone()) {
        initSetupOOBE(runStandardInit);
    } else {
        runStandardInit();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
