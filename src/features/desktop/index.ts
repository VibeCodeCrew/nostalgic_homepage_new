// Рабочий стол: главный рендер, навигация, корзина, инициализация.
// Порт DESKTOP RENDERING (script.js:1470-1543), navToUrl/trashLink (2173-2212),
// BOOKMARK DRAG & DROP (8441-8476), RESPONSIVE RESIZE (8478-8487).

import './desktop.css';
import { STORAGE } from '../../core/keys';
import { setJSON } from '../../core/store';
import { el, escapeHtml, xpIconHtml, getFaviconUrl } from '../../core/dom';
import { debounce } from '../../core/debounce';
import { getPosKey } from '../../core/grid';
import { emit } from '../../core/events';
import {
    links, minimizedTiles, saveLinks, saveTrash, selectedIndices,
    setTrashedLinks, settings, trashedLinks, clearSelection,
} from '../../core/state';
import { deleteScreenshot } from '../../core/screenshots';
import { isSafeUrl } from '../../core/url';
import { registerAction, ACTION } from '../../core/actions';
import type { LinkItem } from '../../core/types';
import { wmClose, wmCreate } from '../../wm/windowManager';
import { refreshDockTrash } from '../themes';
import { assignPositions, getDisplayPos } from './positioning';
import { initDragDeps, initIconDrag, initDesktopDrag } from './dragDrop';
import { initSelection, initMarquee, updateSelectionUI } from './selection';
import { SYSTEM_ICONS_DEF, createSystemIcon } from './systemIcons';
import { initTileDeps, addTileTaskbarBtn, createLinkIconWindow, createFolderIconWindow, createLinkIconXP, createFolderIconXP } from './tileWindows';
import { initGlassDeps, renderGlassGrid, applyGlassOpacity } from './glassGrid';
import { openFolder, refreshFolderWindow } from './folderWindow';
import { ensureSearchWidget, clampSearchWidget } from './searchWidget';
import { initContextMenuRouter } from '../contextmenu/menus';

export { openFolder, refreshFolderWindow } from './folderWindow';
export { ensureSearchWidget, clampSearchWidget, searchUrlFor } from './searchWidget';
export { updateSelectionUI } from './selection';
export { applyGlassOpacity } from './glassGrid';
export { autoArrange, alignToGrid } from './positioning';

// ==================== НАВИГАЦИЯ ====================

export function navToUrl(url: string): void {
    if (!url) return;
    // ФИКС АУДИТА #4: javascript: никогда не исполняем
    if (!isSafeUrl(url) && !/^(edge|chrome|chrome-extension|brave|about):/i.test(url)) {
        if (/^[a-z][a-z0-9+\-.]*:/i.test(url)) return; // неизвестная/опасная схема — игнорируем
    }
    const isBrowserInternal = /^(edge|chrome|chrome-extension|brave|about):/i.test(url);
    const hasProtocol = /^[a-z][a-z0-9+\-.]*:\/\//i.test(url);
    if (isBrowserInternal || !hasProtocol) {
        if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.update({ url: url });
        else window.location.href = url;
    } else {
        window.location.href = url;
    }
}

// Открытие веб-приложения: реализация — features/webapps (Этап 4).
// До установки opener'а — безопасный fallback: обычный переход.
let webAppOpener: ((item: LinkItem) => void) | null = null;

export function setWebAppOpener(fn: (item: LinkItem) => void): void {
    webAppOpener = fn;
}

/** Запуск ярлыка: веб-приложение — в окне, обычная ссылка — переход вкладки. */
export function openLinkItem(item: LinkItem): void {
    if (item && item.app && !item.isFolder && webAppOpener) { webAppOpener(item); return; }
    navToUrl(item.url || '');
}

// ==================== КОРЗИНА ====================

export function trashLink(index: number): void {
    selectedIndices.delete(index);
    const newSel = new Set<number>();
    selectedIndices.forEach(i => { newSel.add(i > index ? i - 1 : i); });
    selectedIndices.clear();
    newSel.forEach(i => selectedIndices.add(i));
    // Сдвиг индексов свёрнутых плиток
    const newMin = new Set<number>();
    minimizedTiles.forEach(i => { if (i !== index) newMin.add(i > index ? i - 1 : i); });
    minimizedTiles.clear();
    newMin.forEach(i => minimizedTiles.add(i));
    // Сдвиг индексов кнопок плиток в таскбаре
    document.querySelectorAll<HTMLElement>('.taskbar-tile-btn').forEach(btn => {
        const i = parseInt(btn.dataset.tileIndex || '', 10);
        if (i === index) btn.remove();
        else if (i > index) btn.dataset.tileIndex = String(i - 1);
    });
    const deleted = links.splice(index, 1)[0];
    if (deleted) {
        const trashed = deleted as LinkItem & { deletedAt?: number };
        trashed.deletedAt = Date.now();
        trashedLinks.push(trashed);
        saveTrash();
        if (deleted.url) deleteScreenshot(deleted.url);
        if (deleted.isFolder && deleted.items) deleted.items.forEach(ch => { if (ch.url) deleteScreenshot(ch.url); });
    }
    saveAndRender();
}

export function confirmEmptyTrash(): void {
    const winId = 'empty-trash-confirm';
    wmClose(winId);
    const c = el('div', { style: 'padding:18px; display:flex; flex-direction:column; gap:14px; background:white;' });
    const msg = el('div', { style: 'font-size:12px; color:#333;' });
    msg.innerHTML = 'Вы уверены, что хотите очистить корзину?<br>Все удалённые элементы будут потеряны навсегда.';
    const bd = el('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' });
    const ok = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'Да' });
    const cn = el('button', { className: 'xp-dialog-btn', text: 'Нет' });
    bd.appendChild(ok); bd.appendChild(cn);
    c.appendChild(msg); c.appendChild(bd);
    wmCreate(winId, 'Очистить корзину', c, 300, 145, xpIconHtml('recycle-bin', 16));
    ok.addEventListener('click', () => {
        setTrashedLinks([]);
        saveTrash();
        wmClose(winId);
        renderDesktop();
    });
    cn.addEventListener('click', () => { wmClose(winId); });
}

// ==================== RENDER ====================

export function saveAndRender(): void {
    saveLinks();
    renderDesktop();
}

/** Debounced-вариант для слайдеров настроек (фикс аудита: полный ребилд на каждый input). */
export const renderDesktopDebounced = debounce(() => renderDesktop(), 100);

export function renderDesktop(): void {
    refreshDockTrash(); // иконка корзины в доке (тема macos)
    // Glass grid — полностью отдельный путь рендеринга
    if (settings.viewMode === 'glass') {
        renderGlassGrid();
        ensureSearchWidget();
        applyGlassOpacity();
        emit('desktop-rendered');
        return;
    }

    assignPositions(false);

    // Миграция: старые плоские x/y/dw/dh → per-mode позиции posIcon/posTile
    const desktopEl = document.getElementById('desktop');
    if (desktopEl) {
        const cw = desktopEl.offsetWidth, ch = desktopEl.offsetHeight;
        const pk = getPosKey();
        let migrated = false;
        links.forEach(item => {
            const flat = item as LinkItem & { x?: number; y?: number; dw?: number; dh?: number };
            if (flat.x !== undefined && !item[pk]) {
                item[pk] = { x: flat.x, y: flat.y ?? 0, dw: flat.dw || cw, dh: flat.dh || ch };
                migrated = true;
            }
        });
        if (migrated) saveLinks();
    }

    const container = document.getElementById('desktop-icons');
    if (!container) return;
    container.innerHTML = '';

    // Скрыть glass-wrapper при переключении из glass-режима
    const gw = document.getElementById('glass-grid-wrapper');
    if (gw) gw.style.display = 'none';

    links.forEach((item, index) => {
        const icon = settings.viewMode === 'window'
            ? (item.isFolder ? createFolderIconWindow(item, index) : createLinkIconWindow(item, index))
            : (item.isFolder ? createFolderIconXP(item, index) : createLinkIconXP(item, index));
        placeIcon(icon, item);
        initIconDrag(icon, item, index);
        container.appendChild(icon);
    });

    let sysSlot = 0;
    SYSTEM_ICONS_DEF.forEach(def => {
        // В теме macos корзина живёт в Dock, на столе её нет (как в настоящем Mac OS X)
        if (settings.theme === 'macos' && def.id === 'recycle') return;
        container.appendChild(createSystemIcon(def, sysSlot++));
    });

    // Скрыть glass-строку поиска
    const gsb = document.getElementById('glass-search-bar');
    if (gsb) gsb.style.display = 'none';

    // Восстановить свёрнутые плитки; вычистить протухшие индексы
    const staleMin: number[] = [];
    minimizedTiles.forEach(idx => {
        const node = container.querySelector<HTMLElement>('.desktop-icon[data-index="' + idx + '"]');
        if (node) { node.style.display = 'none'; addTileTaskbarBtn(idx); }
        else staleMin.push(idx);
    });
    staleMin.forEach(idx => { minimizedTiles.delete(idx); });
    document.querySelectorAll<HTMLElement>('.taskbar-tile-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.tileIndex || '', 10);
        if (isNaN(idx) || !links[idx]) btn.remove();
    });

    updateSelectionUI();
    applyGlassOpacity();
    ensureSearchWidget();
    emit('desktop-rendered');
}

function placeIcon(icon: HTMLElement, item: LinkItem): void {
    const pos = getDisplayPos(item);
    icon.style.left = pos.x + 'px';
    icon.style.top = pos.y + 'px';
}

// ==================== УДАЛЕНИЕ ВЫДЕЛЕННЫХ (клавиша Delete) ====================

function showDeleteConfirm(msg: string, onConfirm: () => void): void {
    const winId = 'delete-confirm';
    wmClose(winId);
    const c = el('div', { style: 'padding:18px;display:flex;flex-direction:column;gap:14px;background:white;' });
    const msgEl = el('div', { style: 'font-size:12px;color:#333;', text: msg });
    const bd = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' });
    const ok = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'Да' });
    const cn = el('button', { className: 'xp-dialog-btn', text: 'Нет' });
    bd.appendChild(ok); bd.appendChild(cn);
    c.appendChild(msgEl); c.appendChild(bd);
    wmCreate(winId, 'Подтверждение удаления', c, 320, 130, xpIconHtml('delete', 16));
    ok.addEventListener('click', () => { wmClose(winId); onConfirm(); });
    cn.addEventListener('click', () => { wmClose(winId); });
}

export function deleteSelectedIcons(): void {
    if (!selectedIndices.size) return;
    const indices = Array.from(selectedIndices);
    const folderCount = indices.filter(i => links[i] && links[i].isFolder).length;
    const linkCount = indices.length - folderCount;
    function doDelete(): void {
        indices.sort((a, b) => b - a).forEach(i => { trashLink(i); });
        clearSelection();
        renderDesktop();
    }
    if (folderCount > 0) {
        let msg = 'Удалить в корзину: ';
        if (folderCount) msg += folderCount + ' папк' + (folderCount === 1 ? 'у' : 'и');
        if (folderCount && linkCount) msg += ' и ';
        if (linkCount) msg += linkCount + ' ярлык' + (linkCount === 1 ? '' : 'а');
        msg += '?';
        showDeleteConfirm(msg, doDelete);
    } else {
        doDelete();
    }
}

// ==================== BOOKMARK DRAG & DROP ====================
// Внешние дропы (закладки/ссылки из браузера) на рабочий стол и в окна папок.
// Реальные обработчики — features/shortcuts (Этап 3) через setDropHandlers.

export interface DropHandlers {
    onLinkDrop: (e: DragEvent, folderIndex: number | null) => void;
    onFolderDrop: (e: DragEvent, folderIndex: number | null) => void;
}

let dropHandlers: DropHandlers | null = null;

export function setDropHandlers(handlers: DropHandlers): void {
    dropHandlers = handlers;
}

function handleLinkDropInternal(e: DragEvent, folderIndex: number | null): void {
    if (dropHandlers) dropHandlers.onLinkDrop(e, folderIndex);
}

function handleFolderDropInternal(e: DragEvent, folderIndex: number | null): void {
    if (dropHandlers) dropHandlers.onFolderDrop(e, folderIndex);
}

function canAcceptDrop(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    const t = Array.from(dt.types || []);
    return t.includes('text/uri-list') || (t.includes('text/plain') && !t.includes('Files'));
}

function dispatchDrop(e: DragEvent, folderIndex: number | null): void {
    if ((e.target as HTMLElement).closest('.desktop-icon')) return;
    e.preventDefault();
    const types = Array.from(e.dataTransfer?.types || []);
    if (types.includes('text/uri-list')) {
        handleLinkDropInternal(e, folderIndex);
    } else if (types.includes('text/plain')) {
        const text = (e.dataTransfer?.getData('text/plain') || '').trim();
        if (/^https?:\/\//i.test(text) || /^[\w.-]+\.[a-z]{2,}/i.test(text)) handleLinkDropInternal(e, folderIndex);
        else if (text) handleFolderDropInternal(e, folderIndex);
    }
}

// ==================== INIT ====================

export function initDesktop(): void {
    // Связывание зависимостей подмодулей
    initDragDeps({
        saveAndRender: saveAndRender,
        renderDesktop: renderDesktop,
        trashLink: trashLink,
    });
    initTileDeps({
        openLinkItem: openLinkItem,
        openFolder: openFolder,
        trashLink: trashLink,
        navToUrl: navToUrl,
    });
    initGlassDeps({
        saveAndRender: saveAndRender,
        navToUrl: navToUrl,
        handleExternalDrop: handleLinkDropInternal,
    });

    const container = document.getElementById('desktop-icons');
    if (container) initMarquee(container);
    initSelection();
    initDesktopDrag();
    initContextMenuRouter();
    registerAction(ACTION.deleteSelected, deleteSelectedIcons);

    // Перерисовка НЕ подписана на 'links-changed' автоматически: многие операции
    // (drag-позиции) пишут saveLinks() без перерисовки — как в оригинале.
    // Событие слушают вторичные потребители (Clippy, док).

    // Внешние дропы на рабочий стол
    const desk = document.getElementById('desktop');
    if (desk) {
        desk.addEventListener('dragover', e => {
            if ((e.target as HTMLElement).closest('.desktop-icon') || !canAcceptDrop(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'link';
        });
        desk.addEventListener('drop', e => { dispatchDrop(e, null); });
    }
    // Внешние дропы в окна папок
    document.addEventListener('dragover', e => {
        const fc = (e.target as HTMLElement).closest('.folder-window-content');
        if (!fc || !canAcceptDrop(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'link';
    });
    document.addEventListener('drop', e => {
        const fc = (e.target as HTMLElement).closest('.folder-window-content');
        if (!fc) return;
        const win = fc.closest('.xp-window[id^="win-folder-"]');
        if (win) dispatchDrop(e, parseInt(win.id.replace('win-folder-', ''), 10));
    });

    // RESPONSIVE RESIZE: только визуальная перерисовка — сохранённые позиции не трогаем
    window.addEventListener('resize', debounce(() => {
        renderDesktop();
        const dsw = document.getElementById('desktop-search-widget');
        if (dsw) clampSearchWidget(dsw);
    }, 150));
}
