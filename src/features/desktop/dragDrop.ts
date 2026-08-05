// Drag & drop иконок рабочего стола: одиночный/групповой drag ярлыков и системных
// иконок, drop в папки (иконка и открытое окно), drop на корзину, anti-overlap,
// режим autoArrangeIcons. Порт секции DRAG оригинального script.js (~798-1089).

import { getPosKey, snapPos } from '../../core/grid';
import { links, saveLinks, selectedIndices, selectedSysIds, settings } from '../../core/state';
import { wmWindows } from '../../wm/windowManager';
import type { LinkItem } from '../../core/types';
import { findFreePosition, getGlassGrid, alignToGrid } from './positioning';
import { saveSysIconPos } from './systemIcons';
import { updateSelectionUI } from './selection';

// Колбэки, которые dragDrop не может импортировать напрямую без жёсткого цикла
// на уровне модулей — index.ts устанавливает их при инициализации.
export interface DragDeps {
    saveAndRender: () => void;
    renderDesktop: () => void;
    trashLink: (index: number) => void;
}

let deps: DragDeps;

export function initDragDeps(d: DragDeps): void {
    deps = d;
}

interface GroupDragItem {
    icon: HTMLElement;
    item?: LinkItem;
    index?: number;
    sysId?: string;
    iconX: number;
    iconY: number;
}

interface DragData {
    multi: boolean;
    items: GroupDragItem[];
    icon?: HTMLElement;
    item?: LinkItem;
    index?: number;
    startX: number;
    startY: number;
    iconX: number;
    iconY: number;
    moved: boolean;
    _dw: number;
    _dh: number;
    _folderIcons: HTMLElement[];
    _recycleIcon: HTMLElement | null;
}

let dragData: DragData | null = null;

function desktopDims(): { dw: number; dh: number } {
    const desk = document.getElementById('desktop');
    return { dw: desk ? desk.offsetWidth : 1200, dh: desk ? desk.offsetHeight : 800 };
}

function pointInRect(x: number, y: number, r: DOMRect): boolean {
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// Обновить содержимое открытого окна папки (ссылка на объект папки стабильна).
function refreshOpenFolderWindow(fIdx: number): void {
    const wEntry = wmWindows['folder-' + fIdx];
    if (wEntry && wEntry.el) {
        const w = wEntry.el as HTMLElement & { _renderFolderContent?: () => void };
        if (w._renderFolderContent) w._renderFolderContent();
    }
}

// Собрать элементы группового drag: выделенные ярлыки + выделенные системные иконки
export function collectGroupDragItems(): GroupDragItem[] {
    const items: GroupDragItem[] = [];
    document.querySelectorAll<HTMLElement>('.desktop-icon[data-index]').forEach(el => {
        const idx = parseInt(el.dataset.index || '', 10);
        if (selectedIndices.has(idx) && links[idx]) {
            items.push({
                icon: el, item: links[idx], index: idx,
                iconX: parseFloat(el.style.left) || 0,
                iconY: parseFloat(el.style.top) || 0,
            });
        }
    });
    document.querySelectorAll<HTMLElement>('.sys-icon').forEach(el => {
        const sysId = el.dataset.sysId || '';
        if (selectedSysIds.has(sysId)) {
            items.push({
                icon: el, sysId: sysId,
                iconX: parseFloat(el.style.left) || 0,
                iconY: parseFloat(el.style.top) || 0,
            });
        }
    });
    return items;
}

function fillDragCache(dd: DragData): void {
    const dims = desktopDims();
    dd._dw = dims.dw;
    dd._dh = dims.dh;
    dd._folderIcons = Array.from(document.querySelectorAll<HTMLElement>('.desktop-icon.folder-icon'));
    dd._recycleIcon = document.querySelector<HTMLElement>('.sys-icon[data-sys-id="recycle"]');
}

/** Начать групповой drag (вызывается из mousedown системной иконки, входящей в выделение). */
export function beginGroupDrag(icon: HTMLElement, e: MouseEvent): void {
    e.preventDefault();
    dragData = {
        multi: true, items: collectGroupDragItems(),
        startX: e.clientX, startY: e.clientY,
        iconX: 0, iconY: 0, moved: false,
        _dw: 1200, _dh: 800, _folderIcons: [], _recycleIcon: null,
    };
    fillDragCache(dragData);
    icon.style.zIndex = '999';
}

export function initIconDrag(icon: HTMLElement, item: LinkItem, index: number): void {
    icon.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('.tile-btns') || target.closest('.tile-resize-handle')) return;
        if (icon.classList.contains('add-btn-tile') || icon.classList.contains('add-btn-icon')) return;
        e.preventDefault();

        // Клик по невыделенной иконке — обновить выделение
        if (!selectedIndices.has(index)) {
            if (!e.ctrlKey) { selectedIndices.clear(); selectedIndices.add(index); }
            else { selectedIndices.add(index); }
            updateSelectionUI();
        }

        if (selectedIndices.size + selectedSysIds.size > 1) {
            // Multi-drag: стартовые позиции — ВИЗУАЛЬНЫЕ (масштабированные)
            beginGroupDrag(icon, e);
        } else {
            dragData = {
                multi: false, items: [], icon: icon, item: item, index: index,
                startX: e.clientX, startY: e.clientY,
                // ВИЗУАЛЬНАЯ (масштабированная) позиция, не сырые сохранённые координаты
                iconX: parseFloat(icon.style.left) || 0,
                iconY: parseFloat(icon.style.top) || 0,
                moved: false,
                _dw: 1200, _dh: 800, _folderIcons: [], _recycleIcon: null,
            };
            fillDragCache(dragData);
            icon.style.zIndex = '999';
        }
    });
}

/** Глобальные слушатели drag — вешаются один раз из initDesktop(). */
export function initDesktopDrag(): void {
    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragData) return;
        const dx = e.clientX - dragData.startX, dy = e.clientY - dragData.startY;
        if (!dragData.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        dragData.moved = true;

        const dw = dragData._dw || 1200;
        const dh = dragData._dh || 800;

        if (dragData.multi) {
            dragData.items.forEach(d => {
                d.icon.classList.add('dragging');
                let x = d.iconX + dx, y = d.iconY + dy;
                x = Math.max(0, Math.min(x, dw - d.icon.offsetWidth));
                y = Math.max(0, Math.min(y, dh - d.icon.offsetHeight));
                d.icon.style.left = x + 'px';
                d.icon.style.top = y + 'px';
            });
            // Подсветка папок при групповом drag
            const selectedIds = new Set(dragData.items.map(d => d.icon.dataset.index ? parseInt(d.icon.dataset.index, 10) : NaN));
            (dragData._folderIcons || []).forEach(fi => {
                const fIdx = parseInt(fi.dataset.index || '', 10);
                if (selectedIds.has(fIdx)) { fi.classList.remove('drag-over'); return; }
                fi.classList.toggle('drag-over', pointInRect(e.clientX, e.clientY, fi.getBoundingClientRect()));
            });
        } else {
            const icon = dragData.icon!;
            icon.classList.add('dragging');
            let x = dragData.iconX + dx, y = dragData.iconY + dy;
            x = Math.max(0, Math.min(x, dw - icon.offsetWidth));
            y = Math.max(0, Math.min(y, dh - icon.offsetHeight));
            icon.style.left = x + 'px';
            icon.style.top = y + 'px';
            // Подсветка папок (только одиночный drag)
            (dragData._folderIcons || []).forEach(fi => {
                const fIdx = parseInt(fi.dataset.index || '', 10);
                if (fIdx === dragData!.index || dragData!.item!.isFolder) { fi.classList.remove('drag-over'); return; }
                fi.classList.toggle('drag-over', pointInRect(e.clientX, e.clientY, fi.getBoundingClientRect()));
            });
        }
        // Подсветка корзины (drop на корзину → удаление; и в single, и в multi)
        if (dragData._recycleIcon) {
            dragData._recycleIcon.classList.toggle('drag-over', pointInRect(e.clientX, e.clientY, dragData._recycleIcon.getBoundingClientRect()));
        }
    });

    document.addEventListener('mouseup', (e: MouseEvent) => {
        if (!dragData) return;
        const dd = dragData; dragData = null;

        if (!dd.moved) {
            if (dd.multi) dd.items.forEach(d => { d.icon.style.zIndex = ''; });
            else if (dd.icon) dd.icon.style.zIndex = '';
            return;
        }

        const dw = dd._dw || 1200;
        const dh = dd._dh || 800;
        const dx = e.clientX - dd.startX, dy = e.clientY - dd.startY;

        if (dd._recycleIcon) dd._recycleIcon.classList.remove('drag-over');

        if (dd.multi) {
            dd.items.forEach(d => { d.icon.classList.remove('dragging'); d.icon.style.zIndex = ''; });

            const selectedIds = new Set(dd.items.map(d => d.icon.dataset.index ? parseInt(d.icon.dataset.index, 10) : NaN));

            // Drop на корзину — удалить все выделенные ярлыки (системные иконки нельзя удалить)
            if (dd._recycleIcon && pointInRect(e.clientX, e.clientY, dd._recycleIcon.getBoundingClientRect())) {
                const indices = dd.items.filter(d => d.item && d.index !== undefined).map(d => d.index!) as number[];
                indices.sort((a, b) => b - a).forEach(i => deps.trashLink(i));
                selectedIndices.clear();
                deps.renderDesktop();
                return;
            }

            let intoFolder = false;

            // Переместить все не-папки из выделения в папку fIdx
            function dropMultiIntoFolder(fIdx: number): void {
                const toMove = dd.items.filter(d => d.item && !d.item.isFolder)
                    .sort((a, b) => (b.index!) - (a.index!));
                let adjFIdx = fIdx;
                toMove.forEach(d => {
                    if (d.index! < adjFIdx) adjFIdx--;
                    const moved = links.splice(d.index!, 1)[0];
                    if (moved) links[adjFIdx].items!.push(moved);
                });
                refreshOpenFolderWindow(fIdx);
                intoFolder = true;
                selectedIndices.clear();
                deps.saveAndRender();
            }

            // Проверка иконок папок
            (dd._folderIcons || []).forEach(fi => {
                fi.classList.remove('drag-over');
                if (intoFolder) return;
                const fIdx = parseInt(fi.dataset.index || '', 10);
                if (selectedIds.has(fIdx)) return;
                if (pointInRect(e.clientX, e.clientY, fi.getBoundingClientRect())) {
                    dropMultiIntoFolder(fIdx);
                }
            });

            // Проверка открытых окон папок
            if (!intoFolder) {
                Object.keys(wmWindows).forEach(wid => {
                    if (intoFolder || !wid.startsWith('folder-')) return;
                    const win = wmWindows[wid];
                    if (!win || win.minimized) return;
                    if (pointInRect(e.clientX, e.clientY, win.el.getBoundingClientRect())) {
                        const fIdx = parseInt(wid.replace('folder-', ''), 10);
                        if (!isNaN(fIdx) && links[fIdx] && links[fIdx].isFolder && !selectedIds.has(fIdx)) {
                            dropMultiIntoFolder(fIdx);
                        }
                    }
                });
            }

            if (!intoFolder) {
                const gg = (settings.viewMode === 'glass' && settings.glassSnap) ? getGlassGrid(dw, dh) : null;
                dd.items.forEach(d => {
                    let x = d.iconX + dx, y = d.iconY + dy;
                    x = Math.max(0, Math.min(x, dw - d.icon.offsetWidth));
                    y = Math.max(0, Math.min(y, dh - d.icon.offsetHeight));
                    if (gg) {
                        x = gg.startX + Math.max(0, Math.round((x - gg.startX) / gg.cellW)) * gg.cellW;
                        y = gg.startY + Math.max(0, Math.round((y - gg.startY) / gg.cellH)) * gg.cellH;
                    } else if (settings.snapToGrid) { const sp = snapPos(x, y); x = sp.x; y = sp.y; }
                    if (d.sysId) saveSysIconPos(d.sysId, x, y, dw, dh);
                    else d.item![getPosKey()] = { x: x, y: y, dw: dw, dh: dh };
                    d.icon.style.left = x + 'px'; d.icon.style.top = y + 'px';
                    (d.icon as HTMLElement & { _wasDragged?: boolean })._wasDragged = true;
                });
                saveLinks();
            }
            return;
        }

        // Одиночный drag
        const icon = dd.icon!;
        const item = dd.item!;
        icon.classList.remove('dragging');

        // Drop на корзину — удалить ярлык (папки тоже можно)
        if (dd._recycleIcon && pointInRect(e.clientX, e.clientY, dd._recycleIcon.getBoundingClientRect())) {
            (dd._folderIcons || []).forEach(fi => fi.classList.remove('drag-over'));
            deps.trashLink(dd.index!);
            return;
        }

        let x = dd.iconX + dx, y = dd.iconY + dy;
        x = Math.max(0, Math.min(x, dw - icon.offsetWidth));
        y = Math.max(0, Math.min(y, dh - icon.offsetHeight));
        if (settings.viewMode === 'glass' && settings.glassSnap) {
            const gg = getGlassGrid(dw, dh);
            x = gg.startX + Math.max(0, Math.round((x - gg.startX) / gg.cellW)) * gg.cellW;
            y = gg.startY + Math.max(0, Math.round((y - gg.startY) / gg.cellH)) * gg.cellH;
        } else if (settings.snapToGrid) { const sp = snapPos(x, y); x = sp.x; y = sp.y; }

        // Проверка drop в папку (иконка + открытое окно)
        let intoFolder = false;
        if (!item.isFolder) {
            (dd._folderIcons || []).forEach(fi => {
                fi.classList.remove('drag-over');
                if (intoFolder) return;
                const fIdx = parseInt(fi.dataset.index || '', 10);
                if (pointInRect(e.clientX, e.clientY, fi.getBoundingClientRect())) {
                    const moved = links.splice(dd.index!, 1)[0];
                    const adjIdx = dd.index! < fIdx ? fIdx - 1 : fIdx;
                    links[adjIdx].items!.push(moved);
                    refreshOpenFolderWindow(fIdx);
                    intoFolder = true;
                    deps.saveAndRender();
                }
            });
            if (!intoFolder) {
                (dd._folderIcons || []).forEach(fi => fi.classList.remove('drag-over'));
                Object.keys(wmWindows).forEach(wid => {
                    if (intoFolder || !wid.startsWith('folder-')) return;
                    const win = wmWindows[wid];
                    if (!win || win.minimized) return;
                    if (pointInRect(e.clientX, e.clientY, win.el.getBoundingClientRect())) {
                        const fIdx = parseInt(wid.replace('folder-', ''), 10);
                        if (!isNaN(fIdx) && links[fIdx] && links[fIdx].isFolder && fIdx !== dd.index) {
                            const moved = links.splice(dd.index!, 1)[0];
                            const adjIdx = dd.index! < fIdx ? fIdx - 1 : fIdx;
                            links[adjIdx].items!.push(moved);
                            refreshOpenFolderWindow(fIdx);
                            intoFolder = true;
                            deps.saveAndRender();
                        }
                    }
                });
            }
        } else {
            document.querySelectorAll('.desktop-icon.folder-icon').forEach(fi => fi.classList.remove('drag-over'));
        }

        if (!intoFolder) {
            const iconExt = icon as HTMLElement & { _wasDragged?: boolean };
            if (settings.autoArrangeIcons) {
                // Режим «Упорядочить автоматически»: иконка встаёт в ближайшую ячейку сетки
                item[getPosKey()] = { x: x, y: y, dw: dw, dh: dh };
                icon.style.zIndex = '';
                iconExt._wasDragged = true;
                alignToGrid(deps.renderDesktop);
            } else {
                const fp = findFreePosition(x, y, icon.offsetWidth, icon.offsetHeight, new Set([icon]));
                x = fp.x; y = fp.y;
                item[getPosKey()] = { x: x, y: y, dw: dw, dh: dh };
                icon.style.left = x + 'px'; icon.style.top = y + 'px';
                icon.style.zIndex = '';
                iconExt._wasDragged = true;
                saveLinks();
            }
        }
    });
}
