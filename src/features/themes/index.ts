// Темы оформления: 'xp' (по умолчанию) или 'macos' (Mac OS X Aqua) — порт THEMES (script.js:1102-1156).
// Тема — это скин: body[data-theme] + CSS-блок themes.css + меню-бар/док (macos).
// Вся логика (окна, ярлыки, приложения) от темы не зависит.

import './themes.css';
import { STORAGE, KEY_CUSTOM_BG_DATA, MARKER_CUSTOM } from '../../core/keys';
import { migrateBlobToChromeStorage } from '../../core/screenshots';
import { settings, updateSetting } from '../../core/state';
import { on, emit } from '../../core/events';
import { xpIconHtml } from '../../core/dom';
import { wmWindows, setTaskbarIconTransform } from '../../wm/windowManager';
import type { ThemeId } from '../../core/types';
import { applyBackground } from './background';
import { ensureMacMenuBar, removeMacMenuBar } from './macMenuBar';
import { DOCK_APPS, macDockIconSrc, renderDockPinned, removeDockPinned, refreshDockTrash, initDockMagnify } from './dock';

export { applyBackground } from './background';
export { ensureMacMenuBar, removeMacMenuBar } from './macMenuBar';
export {
    DOCK_APPS, DOCK_DEFAULT, macDockIconSrc, macIcon, macIcon16,
    getDockItems, saveDockItems, dockHasUrl, addUrlToDock,
    renderDockPinned, removeDockPinned, refreshDockTrash, dockAddSubmenu, initDockMagnify,
} from './dock';
export type { DockEntry, DockAppDef } from './dock';

/** Хук wm: иконка кнопки таскбара под текущую тему.
 *  macos: DOCK_APPS → mac-набор, остальные — замена icons/16/ → icons/64/; xp — наоборот. */
function transformTaskbarIcon(id: string, iconHtml: string): string {
    if (settings.theme === 'macos' && DOCK_APPS[id]) {
        return '<img class="xp-icon-img" src="' + macDockIconSrc(id) + '" width="16" height="16" alt="">';
    }
    if (settings.theme !== 'macos' && DOCK_APPS[id]) {
        return xpIconHtml(DOCK_APPS[id].icon, 16);
    }
    return iconHtml.replace(
        settings.theme === 'macos' ? 'icons/16/' : 'icons/64/',
        settings.theme === 'macos' ? 'icons/64/' : 'icons/16/');
}

export function applyTheme(): void {
    document.body.dataset.theme = settings.theme;
    applyBackground();
    if (settings.theme === 'macos') {
        ensureMacMenuBar();
        renderDockPinned();
        initDockMagnify();
    } else {
        removeMacMenuBar();
        removeDockPinned();
        // Сбросить fish-eye: трансформации иконок и растянутое состояние дока
        const tb = document.getElementById('taskbar');
        if (tb) tb.classList.remove('dock-hover');
        document.querySelectorAll<HTMLElement>('#taskbar .ql-btn, #taskbar .taskbar-win-btn, #taskbar .dock-item')
            .forEach((ic) => { ic.style.transform = ''; });
    }
    // Иконки уже открытых окон пересобираем под тему (mac-набор в доке, 16px в XP)
    Object.keys(wmWindows).forEach((id) => {
        const btn = wmWindows[id].taskbarBtn;
        if (!btn) return;
        const span = btn.querySelector('.taskbar-btn-icon');
        if (!span) return;
        span.innerHTML = transformTaskbarIcon(id, span.innerHTML);
    });
}

/** Переключение темы (настройки, меню-бар, OOBE). Сама реакция — подписка
 *  на settings-changed в initThemes: применяет тему и шлёт theme-changed
 *  (рабочий стол пересчитывает пропорции по этому событию). */
export function setTheme(theme: ThemeId): void {
    updateSetting('theme', theme);
}

export function initThemes(): void {
    setTaskbarIconTransform(transformTaskbarIcon);
    // ФИКС АУДИТА #3: старые dataURL-фоны из localStorage переезжают в chrome.storage.local
    // (edge_custom_bg заменяется маркером 'custom', applyBackground резолвит его асинхронно)
    migrateBlobToChromeStorage(STORAGE.bg, KEY_CUSTOM_BG_DATA, MARKER_CUSTOM);
    on('settings-changed', ({ key }) => {
        if (key !== 'theme') return;
        applyTheme();
        emit('theme-changed', { theme: settings.theme });
    });
    // Иконка корзины в доке следит за наполнением корзины
    on('trash-changed', () => { refreshDockTrash(); });
    applyTheme();
}
