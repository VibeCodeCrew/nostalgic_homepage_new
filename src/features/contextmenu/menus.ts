// Определения контекстных меню + глобальный роутер правого клика.
// Порт CONTEXT MENU DEFINITIONS / GLOBAL RIGHT-CLICK ROUTER (script.js:2696-2963).

import { showContextMenu, hideContextMenu } from './index';
import { xpIconHtml } from '../../core/dom';
import { clearSelection, links, saveTrash, selectedIndices, settings, trashedLinks, updateSetting } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { minimizeAll, restoreAll, wmClose, wmFocus, wmMaximize, wmMinimize, wmRestore, wmWindows } from '../../wm/windowManager';
import { dockAddSubmenu, dockHasUrl, addUrlToDock, refreshDockTrash } from '../themes';
import {
    alignToGrid, autoArrange, confirmEmptyTrash, navToUrl, openFolder,
    openLinkItem, refreshFolderWindow, renderDesktop, saveAndRender, trashLink,
} from '../desktop';
import { updateSelectionUI } from '../desktop/selection';
import type { ContextMenuItem } from '../../core/types';

const SEP: ContextMenuItem = { separator: true };

export function showDesktopContextMenu(x: number, y: number): void {
    showContextMenu(x, y, [
        { label: 'Вид', icon: xpIconHtml('desktop', 16), submenu: [
            { label: 'Плитки (стекло)', checked: settings.viewMode === 'glass',  action: () => { updateSetting('viewMode', 'glass'); } },
            { label: 'Окна с превью',  checked: settings.viewMode === 'window', action: () => { updateSetting('viewMode', 'window'); } },
            { label: 'Ярлыки XP',      checked: settings.viewMode === 'icon',   action: () => { updateSetting('viewMode', 'icon'); } },
        ] },
        { label: 'Создать', icon: xpIconHtml('new-folder', 16), submenu: [
            { label: 'Ярлык', icon: xpIconHtml('internet-shortcut', 16), action: () => { runAction(ACTION.addShortcut, { folderIndex: null }); } },
            { label: 'Папку', icon: xpIconHtml('folder', 16), action: () => { runAction(ACTION.addFolder); } },
        ] },
        { label: 'Вставить ярлык', icon: xpIconHtml('paste', 16), action: () => { runAction(ACTION.pasteShortcut, { folderIndex: null }); } },
        SEP,
        { label: 'Привязка к сетке', icon: '⋮', checked: settings.snapToGrid, action: () => {
            updateSetting('snapToGrid', !settings.snapToGrid);
        } },
        { label: 'Выровнять по сетке', icon: '⋮', action: () => { alignToGrid(renderDesktop); } },
        { label: 'Упорядочить автоматически', icon: '☰', checked: settings.autoArrangeIcons, action: () => {
            updateSetting('autoArrangeIcons', !settings.autoArrangeIcons);
            if (settings.autoArrangeIcons) alignToGrid(renderDesktop);
        } },
        { label: 'Упорядочить иконки', icon: '☰', action: () => { autoArrange(renderDesktop); } },
        { label: 'Обновить',           icon: xpIconHtml('update', 16), action: () => { renderDesktop(); } },
        SEP,
        { label: 'Свойства экрана', icon: xpIconHtml('control-panel', 16), action: () => { runAction(ACTION.openSettings); } },
    ]);
}

export function showSysIconContextMenu(x: number, y: number, id: string): void {
    if (id === 'mycomputer') {
        showContextMenu(x, y, [
            { label: 'Открыть',   icon: xpIconHtml('my-computer', 16), action: () => { runAction(ACTION.openMyComputer); } },
            SEP,
            { label: 'Свойства', icon: '⚙️', action: () => { runAction(ACTION.openSettings); } },
        ]);
    } else if (id === 'recycle') {
        showContextMenu(x, y, [
            { label: 'Открыть',         icon: xpIconHtml('recycle-bin', 16), action: () => { runAction(ACTION.openRecycle); } },
            SEP,
            { label: 'Очистить корзину', icon: xpIconHtml('delete', 16), danger: true,
              disabled: trashedLinks.length === 0,
              action: confirmEmptyTrash },
        ]);
    } else if (id === 'doom') {
        showContextMenu(x, y, [
            { label: 'Открыть', icon: xpIconHtml('doom', 16), action: () => { runAction(ACTION.openDoom); } },
        ]);
    }
}

function showMultiSelectContextMenu(x: number, y: number): void {
    const n = selectedIndices.size;
    const indices = Array.from(selectedIndices);
    showContextMenu(x, y, [
        { label: 'Выбрано элементов: ' + n, disabled: true },
        SEP,
        { label: 'Открыть все (' + n + ')', icon: xpIconHtml('play', 16), action: () => {
            indices.forEach(i => {
                const it = links[i];
                if (it && !it.isFolder) window.open(it.url, '_blank');
                else if (it && it.isFolder) openFolder(i);
            });
            clearSelection();
        } },
        SEP,
        { label: 'Удалить выбранные (' + n + ')', icon: '🗑️', danger: true, action: () => {
            Array.from(selectedIndices).sort((a, b) => b - a).forEach(i => {
                const deleted = links.splice(i, 1)[0] as (typeof links[number] & { deletedAt?: number }) | undefined;
                if (deleted) { deleted.deletedAt = Date.now(); trashedLinks.push(deleted); }
            });
            saveTrash();
            selectedIndices.clear();
            saveAndRender();
        } },
    ]);
}

export function showLinkIconContextMenu(x: number, y: number, idx: number): void {
    const item = links[idx];
    if (!item) return;
    if (!selectedIndices.has(idx)) {
        selectedIndices.clear();
        selectedIndices.add(idx);
        updateSelectionUI();
    }
    if (selectedIndices.size > 1) { showMultiSelectContextMenu(x, y); return; }
    showContextMenu(x, y, [
        { label: item.app ? 'Открыть в окне' : 'Открыть', icon: xpIconHtml('play', 16), action: () => { openLinkItem(item); } },
        { label: 'Открыть в новой вкладке', icon: xpIconHtml('go', 16), action: () => { window.open(item.url, '_blank'); } },
        { label: 'Открыть в новом окне',    icon: xpIconHtml('open', 16), action: () => {
            if (typeof chrome !== 'undefined' && chrome.windows) chrome.windows.create({ url: item.url });
            else window.open(item.url, '_blank');
        } },
        { label: 'Инкогнито', icon: '🕵️', action: () => {
            if (typeof chrome !== 'undefined' && chrome.windows) chrome.windows.create({ url: item.url, incognito: true });
            else window.open(item.url, '_blank');
        } },
        // Прикрепить к доку — только в теме macos, где док существует
        ...(settings.theme === 'macos' && !dockHasUrl(item.url || '')
            ? [{ label: 'Добавить в Dock', icon: '➕', action: () => { addUrlToDock(item.url || '', item.name); } } as ContextMenuItem]
            : []),
        { label: 'Веб-приложение (в окне)', icon: '🖥️', checked: !!item.app, action: () => { item.app = !item.app; saveAndRender(); } },
        SEP,
        { label: 'Изменить', icon: xpIconHtml('rename', 16), action: () => { runAction(ACTION.editShortcut, { index: idx, childIndex: null }); } },
        { label: 'Обновить миниатюру', icon: '📸', action: () => { runAction(ACTION.refreshScreenshot, { url: item.url, item }); } },
        { label: 'Удалить',  icon: '🗑️', danger: true, action: () => { trashLink(idx); } },
    ]);
}

export function showFolderIconContextMenu(x: number, y: number, idx: number): void {
    if (!selectedIndices.has(idx)) {
        selectedIndices.clear();
        selectedIndices.add(idx);
        updateSelectionUI();
    }
    if (selectedIndices.size > 1) { showMultiSelectContextMenu(x, y); return; }
    showContextMenu(x, y, [
        { label: 'Открыть',          icon: xpIconHtml('folder-open', 16), action: () => { openFolder(idx); } },
        SEP,
        { label: 'Добавить ярлык',   icon: '🔗', action: () => { runAction(ACTION.addShortcut, { folderIndex: idx }); } },
        { label: 'Вставить ярлык',   icon: '📋', action: () => { runAction(ACTION.pasteShortcut, { folderIndex: idx }); } },
        SEP,
        { label: 'Переименовать',    icon: '✏️', action: () => { runAction(ACTION.editShortcut, { index: idx, childIndex: null }); } },
        { label: 'Удалить',          icon: '🗑️', danger: true, action: () => { trashLink(idx); } },
    ]);
}

function showFolderMultiSelectMenu(x: number, y: number, folderIdx: number, indices: number[]): void {
    const n = indices.length;
    showContextMenu(x, y, [
        { label: 'Выбрано: ' + n, disabled: true },
        SEP,
        { label: 'Открыть все (' + n + ')', icon: xpIconHtml('play', 16), action: () => {
            indices.forEach(ci => {
                const child = links[folderIdx] && links[folderIdx].items![ci];
                if (child) window.open(child.url, '_blank');
            });
        } },
        { label: 'На рабочий стол', icon: '📋', action: () => {
            const moved: typeof links = [];
            Array.from(indices).sort((a, b) => b - a).forEach(ci => {
                const m = links[folderIdx].items!.splice(ci, 1)[0];
                if (m) moved.push(m);
            });
            moved.reverse().forEach(m => { links.push(m); });
            refreshFolderWindow(folderIdx);
        } },
        SEP,
        { label: 'Удалить выбранные (' + n + ')', icon: '🗑️', danger: true, action: () => {
            Array.from(indices).sort((a, b) => b - a).forEach(ci => {
                const d = links[folderIdx].items!.splice(ci, 1)[0] as (typeof links[number] & { deletedAt?: number }) | undefined;
                if (d) { d.deletedAt = Date.now(); trashedLinks.push(d); }
            });
            saveTrash();
            refreshFolderWindow(folderIdx);
        } },
    ]);
}

export function showFolderItemContextMenu(x: number, y: number, folderIdx: number, childIdx: number): void {
    const child = links[folderIdx] && links[folderIdx].items![childIdx];
    if (!child) return;
    showContextMenu(x, y, [
        { label: 'Открыть',                 icon: xpIconHtml('play', 16), action: () => { navToUrl(child.url || ''); } },
        { label: 'Открыть в новой вкладке', icon: '↗️', action: () => { window.open(child.url, '_blank'); } },
        { label: 'Открыть в новом окне',    icon: '🫟', action: () => {
            if (typeof chrome !== 'undefined' && chrome.windows) chrome.windows.create({ url: child.url });
            else window.open(child.url, '_blank');
        } },
        SEP,
        { label: 'На рабочий стол', icon: '📋', action: () => {
            const m = links[folderIdx].items!.splice(childIdx, 1)[0];
            links.push(m);
            refreshFolderWindow(folderIdx);
        } },
        SEP,
        { label: 'Изменить', icon: '✏️', action: () => { runAction(ACTION.editShortcut, { index: folderIdx, childIndex: childIdx }); } },
        { label: 'Удалить',  icon: '🗑️', danger: true, action: () => {
            const d = links[folderIdx].items!.splice(childIdx, 1)[0] as (typeof links[number] & { deletedAt?: number }) | undefined;
            if (d) { d.deletedAt = Date.now(); trashedLinks.push(d); saveTrash(); refreshDockTrash(); }
            refreshFolderWindow(folderIdx);
        } },
    ]);
}

function showWindowContextMenu(x: number, y: number, id: string): void {
    if (!wmWindows[id]) return;
    const w = wmWindows[id];
    showContextMenu(x, y, [
        { label: w.minimized ? 'Восстановить' : 'Свернуть', icon: '_',  action: () => { if (w.minimized) { wmRestore(id); wmFocus(id); } else wmMinimize(id); } },
        { label: w.maximized ? 'Восстановить размер' : 'Развернуть', icon: '&#9633;', action: () => { wmMaximize(id); } },
        SEP,
        { label: 'Закрыть', icon: xpIconHtml('delete', 16), danger: true, action: () => { wmClose(id); } },
    ]);
}

function showTaskbarBtnContextMenu(x: number, y: number, btn: HTMLElement): void {
    const id = Object.keys(wmWindows).find(k => wmWindows[k].taskbarBtn === btn);
    if (!id) return;
    const w = wmWindows[id];
    showContextMenu(x, y, [
        { label: w.minimized ? 'Восстановить' : 'Свернуть', action: () => { if (w.minimized) { wmRestore(id); wmFocus(id); } else wmMinimize(id); } },
        { label: 'Закрыть', danger: true, action: () => { wmClose(id); } },
    ]);
}

function showTaskbarContextMenu(x: number, y: number): void {
    // В теме macos пустое место дока — меню редактирования Dock
    if (settings.theme === 'macos') {
        showContextMenu(x, y, [
            { label: 'Добавить в Dock', icon: '➕', submenu: dockAddSubmenu() },
            SEP,
            { label: 'Свернуть все окна',   icon: '▼', action: minimizeAll },
            { label: 'Восстановить окна',   icon: '▲', action: restoreAll },
        ]);
        return;
    }
    showContextMenu(x, y, [
        { label: 'Свернуть все окна',   icon: '▼', action: minimizeAll },
        { label: 'Восстановить окна',   icon: '▲', action: restoreAll },
        SEP,
        { label: 'Панель задач — свойства', icon: '⚙️', action: () => { runAction(ACTION.openSettings); } },
    ]);
}

function showSystrayContextMenu(x: number, y: number): void {
    showContextMenu(x, y, [
        { label: new Date().toLocaleString('ru-RU'), icon: '🕒', disabled: true },
        SEP,
        { label: 'Настройки', icon: '⚙️', action: () => { runAction(ACTION.openSettings); } },
    ]);
}

// ==================== GLOBAL RIGHT-CLICK ROUTER ====================

export function initContextMenuRouter(): void {
    document.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        const x = e.clientX, y = e.clientY;
        const target = e.target as HTMLElement;
        if (target.closest('#context-menu') || target.closest('#start-menu')) return;

        const sysIcon = target.closest<HTMLElement>('.sys-icon');
        const linkIcon = target.closest<HTMLElement>('.desktop-icon.link-icon:not(.add-btn-tile)');
        const folderIcon = target.closest<HTMLElement>('.desktop-icon.folder-icon');
        const folderItem = target.closest<HTMLElement>('.folder-item:not(.add-item)');
        const titlebar = target.closest<HTMLElement>('.xp-titlebar');
        const folderWinEl = target.closest<HTMLElement>('.xp-window[id^="win-folder-"]');
        const taskbarBtn = target.closest<HTMLElement>('.taskbar-win-btn');
        const systray = target.closest('#systray');
        const taskbar = target.closest('#taskbar');
        const desktop = target.closest('#desktop');

        if (sysIcon) {
            showSysIconContextMenu(x, y, sysIcon.dataset.sysId || '');
        } else if (linkIcon) {
            showLinkIconContextMenu(x, y, parseInt(linkIcon.dataset.index || '', 10));
        } else if (folderIcon) {
            showFolderIconContextMenu(x, y, parseInt(folderIcon.dataset.index || '', 10));
        } else if (folderItem) {
            const win = folderItem.closest('.xp-window') as (HTMLElement & {
                _folderIndex?: number;
                _selectedFolderItems?: Set<number>;
                _updateFolderItemSelection?: () => void;
            }) | null;
            if (win && win._folderIndex !== undefined) {
                const allItems = Array.from(win.querySelectorAll('.folder-item:not(.add-item)'));
                const ci = allItems.indexOf(folderItem);
                if (ci < 0) return;
                const sel = win._selectedFolderItems;
                // Если кликнули по элементу вне выделения — сбросить выделение на него
                if (sel && !sel.has(ci)) {
                    sel.clear();
                    sel.add(ci);
                    if (win._updateFolderItemSelection) win._updateFolderItemSelection();
                }
                if (sel && sel.size > 1) {
                    showFolderMultiSelectMenu(x, y, win._folderIndex, Array.from(sel));
                } else {
                    showFolderItemContextMenu(x, y, win._folderIndex, ci);
                }
            }
        } else if (folderWinEl && !titlebar) {
            const folderIdx = parseInt(folderWinEl.id.replace('win-folder-', ''), 10);
            showContextMenu(x, y, [
                { label: 'Вставить ярлык',       icon: '📋', action: () => { runAction(ACTION.pasteShortcut, { folderIndex: folderIdx }); } },
                SEP,
                { label: 'Добавить ярлык вручную', icon: '🔗', action: () => { runAction(ACTION.addShortcut, { folderIndex: folderIdx }); } },
            ]);
        } else if (titlebar && !titlebar.closest('.desktop-icon')) {
            const win = titlebar.closest('.xp-window');
            if (win) showWindowContextMenu(x, y, win.id.replace('win-', ''));
        } else if (taskbarBtn) {
            showTaskbarBtnContextMenu(x, y, taskbarBtn);
        } else if (systray) {
            showSystrayContextMenu(x, y);
        } else if (taskbar) {
            showTaskbarContextMenu(x, y);
        } else if (desktop) {
            showDesktopContextMenu(x, y);
        }
    });

    // Клик вне меню — скрыть (как в оригинале, GLOBAL LISTENERS)
    document.addEventListener('click', e => {
        if (!(e.target as HTMLElement).closest('#context-menu')) hideContextMenu();
    });
    window.addEventListener('blur', hideContextMenu);
    window.addEventListener('resize', hideContextMenu);
}
