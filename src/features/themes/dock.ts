// Dock (тема macos): редактируемый набор закреплённых приложений и сайтов
// (порт script.js:1278-1454). Не путать с XP Quick Launch: это отдельный
// список в localStorage (edge_dock_items). Здесь же fish-eye увеличение иконок.

import { STORAGE } from '../../core/keys';
import { safeParse, getStrOrNull, setJSON } from '../../core/store';
import { settings, trashedLinks } from '../../core/state';
import { getFaviconUrl } from '../../core/dom';
import { runAction, ACTION } from '../../core/actions';
import { rafThrottle } from '../../core/debounce';
import { showContextMenu, MENU_SEP } from '../contextmenu';
import type { ContextMenuItem } from '../../core/types';

export interface DockAppDef {
    name: string;
    icon: string;      // имя png из icons/ (XP-набор, для таскбара XP-темы)
    action: () => void;
}

/** Элемент дока: строка — id приложения из DOCK_APPS, объект {url,name} — ярлык сайта. */
export type DockEntry = string | { url: string; name: string };

// Запуск приложений — через командный реестр: сами приложения портируются позже,
// до регистрации обработчиков это no-op с warning (это нормально).
export const DOCK_APPS: Record<string, DockAppDef> = {
    mycomputer:  { name: 'Мой компьютер',    icon: 'my-computer',   action: () => runAction(ACTION.openMyComputer) },
    internet:    { name: 'Интернет',         icon: 'internet',      action: () => { chrome.tabs.create({}); } },
    search:      { name: 'Поиск',            icon: 'search',        action: () => runAction(ACTION.openSearch) },
    notepad:     { name: 'Блокнот',          icon: 'notepad',       action: () => runAction('app:notepad') },
    wordpad:     { name: 'WordPad',          icon: 'wordpad',       action: () => runAction('app:wordpad') },
    paint:       { name: 'Paint',            icon: 'paint',         action: () => runAction('app:paint') },
    calculator:  { name: 'Калькулятор',      icon: 'calculator',    action: () => runAction('app:calculator') },
    cmd:         { name: 'Командная строка', icon: 'cmd',           action: () => runAction('app:cmd') },
    minesweeper: { name: 'Сапёр',            icon: 'minesweeper',   action: () => runAction('app:minesweeper') },
    solitaire:   { name: 'Косынка',          icon: 'solitaire',     action: () => runAction('app:solitaire') },
    hearts:      { name: 'Червы',            icon: 'hearts',        action: () => runAction('app:hearts') },
    pinball:     { name: 'Пинбол',           icon: 'pinball',       action: () => runAction(ACTION.openPinball) },
    doom:        { name: 'DOOM',             icon: 'doom',          action: () => runAction(ACTION.openDoom) },
    stickies:    { name: 'Стикер',           icon: 'sticky',        action: () => runAction(ACTION.newSticky) },
    recycle:     { name: 'Корзина',          icon: 'recycle-bin',   action: () => runAction(ACTION.openRecycle) },
    settings:    { name: 'Настройки',        icon: 'control-panel', action: () => runAction(ACTION.openSettings) },
};

export const DOCK_DEFAULT: DockEntry[] = ['mycomputer', 'internet', 'notepad', 'paint', 'calculator', 'minesweeper', 'doom', 'recycle'];

/** Путь к mac-иконке приложения (набор Cheetah, GPL-3.0 — см. THIRD_PARTY.md).
 *  У DOOM своя обложка, корзина — по наполнению. */
export function macDockIconSrc(id: string): string {
    if (id === 'doom') return 'icons/64/doom.png';
    if (id === 'recycle') return 'icons/mac/' + (trashedLinks.length === 0 ? 'trash-empty' : 'trash-full') + '.png';
    return 'icons/mac/' + id + '.png';
}

/** mac-иконка произвольного размера (html) для меню и проводников. */
export function macIcon(id: string, size: number): string {
    return '<img class="xp-icon-img" src="' + macDockIconSrc(id) + '" width="' + size + '" height="' + size + '" alt="">';
}

/** 16px mac-иконка (html) для пунктов меню. */
export function macIcon16(id: string): string {
    return macIcon(id, 16);
}

export function getDockItems(): DockEntry[] {
    const arr = safeParse<unknown>(getStrOrNull(STORAGE.dockItems), null);
    if (Array.isArray(arr)) {
        return arr.filter((it): it is DockEntry =>
            (typeof it === 'string' && !!DOCK_APPS[it]) ||
            (!!it && typeof it === 'object' && typeof (it as { url?: unknown }).url === 'string'));
    }
    return DOCK_DEFAULT.slice();
}

export function saveDockItems(items: DockEntry[]): void {
    setJSON(STORAGE.dockItems, items);
}

export function dockHasUrl(url: string): boolean {
    return getDockItems().some((it) => typeof it === 'object' && it.url === url);
}

/** Прикрепить ярлык сайта к доку (контекстное меню ярлыка, drag&drop в док). */
export function addUrlToDock(url: string, name?: string): boolean {
    if (dockHasUrl(url)) return false;
    const items = getDockItems();
    items.push({ url: url, name: name || url });
    saveDockItems(items);
    renderDockPinned();
    return true;
}

/** Рендер закреплённых иконок дока; #quick-launch (XP) не трогаем — он просто скрыт CSS. */
export function renderDockPinned(): void {
    const tb = document.getElementById('taskbar');
    if (!tb) return;
    let dock = document.getElementById('dock-pinned');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'dock-pinned';
        tb.insertBefore(dock, document.getElementById('taskbar-windows') || null);
    }
    dock.innerHTML = '';
    getDockItems().forEach((entry) => {
        const isApp = typeof entry === 'string';
        const app = isApp ? DOCK_APPS[entry] : null;
        const name = isApp ? app!.name : entry.name;
        const openFn = isApp ? app!.action : () => { window.open((entry as { url: string }).url, '_blank'); };
        const removeFn = (): void => {
            saveDockItems(getDockItems().filter((x) =>
                isApp ? x !== entry : !(typeof x === 'object' && x.url === (entry as { url: string }).url)));
            renderDockPinned();
        };
        const b = document.createElement('button');
        b.className = 'dock-item';
        b.title = name;
        b.setAttribute('aria-label', name);
        if (isApp) {
            b.innerHTML = '<img src="' + macDockIconSrc(entry as string) + '" width="40" height="40" alt="">';
            b.dataset.app = entry as string;
        } else {
            // Ярлык сайта: фавикон, фолбэк — стандартная иконка
            const img = document.createElement('img');
            img.width = 40; img.height = 40; img.alt = '';
            img.src = getFaviconUrl((entry as { url: string }).url) || 'icons/64/internet-shortcut.png';
            img.onerror = () => { img.onerror = null; img.src = 'icons/64/internet-shortcut.png'; };
            b.appendChild(img);
        }
        b.addEventListener('click', openFn);
        b.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, [
                { label: 'Открыть', action: openFn },
                MENU_SEP,
                { label: 'Убрать из Dock', danger: true, action: removeFn },
            ]);
        });
        dock!.appendChild(b);
    });
}

export function removeDockPinned(): void {
    const dock = document.getElementById('dock-pinned');
    if (dock) dock.remove();
}

/** Обновить иконку корзины в доке по наполнению (подписка на trash-changed — в themes/index). */
export function refreshDockTrash(): void {
    if (settings.theme !== 'macos') return;
    const img = document.querySelector<HTMLImageElement>('#dock-pinned .dock-item[data-app="recycle"] img');
    if (img) img.src = macDockIconSrc('recycle');
}

/** Подменю «Добавить в Dock»: галочка = уже в доке, клик переключает (как Keep in Dock).
 *  Используется контекстным меню таскбара (фича contextmenu). */
export function dockAddSubmenu(): ContextMenuItem[] {
    const current = getDockItems();
    return Object.keys(DOCK_APPS).map((id) => {
        const app = DOCK_APPS[id];
        return {
            label: app.name,
            icon: '<img class="xp-icon-img" src="' + macDockIconSrc(id) + '" width="16" height="16" alt="">',
            checked: current.indexOf(id) !== -1,
            action: () => {
                let items = getDockItems();
                if (items.indexOf(id) === -1) items.push(id);
                else items = items.filter((x) => x !== id);
                saveDockItems(items);
                renderDockPinned();
            },
        };
    });
}

// ---- Fish-eye увеличение иконок дока (только тема macos) ----

let dockMagnifyBound = false;

export function initDockMagnify(): void {
    if (dockMagnifyBound) return;
    dockMagnifyBound = true;
    // rafThrottle: пересчёт transform максимум раз за кадр (фикс аудита —
    // в оригинале голый mousemove; ловушка 12 AGENTS.md).
    const onMove = rafThrottle((e: MouseEvent) => {
        if (settings.theme !== 'macos') return;
        const tb = document.getElementById('taskbar');
        if (!tb) return;
        const over = tb.contains(e.target as Node);
        // Док разъезжается ОДИН раз при входе курсора (класс .dock-hover задаёт
        // фиксированные отступы, достаточные для максимального зума), а дальше
        // иконки меняют только transform — раскладка статична, подёргивания нет
        tb.classList.toggle('dock-hover', over);
        const icons = tb.querySelectorAll<HTMLElement>('.ql-btn, .taskbar-win-btn, .dock-item');
        icons.forEach((ic) => {
            let s = 1;
            if (over) {
                const r = ic.getBoundingClientRect();
                const dx = Math.abs(e.clientX - (r.left + r.width / 2));
                if (dx < 150) s = 1 + 0.9 * (1 - dx / 150);
            }
            ic.style.transform = s === 1 ? '' : 'scale(' + s.toFixed(3) + ')';
        });
    });
    document.addEventListener('mousemove', onMove);
}
