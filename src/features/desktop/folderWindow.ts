// Окно папки (XP Explorer для папок рабочего стола) + drag элементов папки
// на рабочий стол. Порт FOLDER ITEM DRAG TO DESKTOP / FOLDER WINDOW (script.js:2214-2403).

import { el, escapeHtml, xpIconHtml, getFaviconUrl } from '../../core/dom';
import { SNAP_TILE, getPosKey, snapPos } from '../../core/grid';
import { links, saveLinks, settings } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { wmCreate, wmClose, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { navToUrl, renderDesktop } from './index';
import type { LinkItem } from '../../core/types';

// Дополненный тип окна папки (поля навешиваются после wmCreate)
export interface FolderWinExt extends HTMLElement {
    _renderFolderContent?: () => void;
    _folderIndex?: number;
    _selectedFolderItems?: Set<number>;
    _updateFolderItemSelection?: () => void;
}

export function getFolderWin(el: Element | null): FolderWinExt | null {
    return el ? (el as FolderWinExt) : null;
}

function initFolderItemDrag(
    itemEl: HTMLElement,
    child: LinkItem,
    ci: number,
    folderIndex: number,
    getWin: () => FolderWinExt | null,
    selectedFolderItems: Set<number>,
): void {
    itemEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // не запускать rubber-band папки

        const startX = e.clientX, startY = e.clientY;
        let moved = false;
        let dragGhost: HTMLElement | null = null;

        // Элементы для drag: всё выделение, если этот элемент в нём, иначе — только он
        const dragCIs = (selectedFolderItems.has(ci) && selectedFolderItems.size > 1)
            ? Array.from(selectedFolderItems) : [ci];

        function onMove(ev: MouseEvent): void {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
            if (!moved) {
                moved = true;
                dragGhost = el('div', { className: 'folder-drag-ghost' });
                const fav = child.customIcon || getFaviconUrl(child.url || '');
                dragGhost.innerHTML =
                    '<img src="' + escapeHtml(fav) + '" style="width:14px;height:14px;object-fit:contain;flex-shrink:0" alt="">' +
                    '<span>' + escapeHtml(child.name) + (dragCIs.length > 1 ? ' +' + (dragCIs.length - 1) : '') + '</span>';
                document.body.appendChild(dragGhost);
            }
            if (dragGhost) {
                dragGhost.style.left = (ev.clientX + 12) + 'px';
                dragGhost.style.top = (ev.clientY + 12) + 'px';
            }
        }

        function onUp(ev: MouseEvent): void {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (dragGhost) { dragGhost.remove(); dragGhost = null; }
            if (!moved) return;

            (itemEl as HTMLElement & { _wasDragged?: boolean })._wasDragged = true;

            // Цель дропа (ghost уже удалён — elementFromPoint чистый)
            const target = document.elementFromPoint(ev.clientX, ev.clientY);
            const myWin = getWin();
            const droppedInsideSameWin = !!(target && myWin && target.closest('.xp-window') && target.closest('.xp-window') === myWin);

            if (!droppedInsideSameWin) {
                // Дроп на рабочий стол — вынуть элементы из папки
                const desktop = document.getElementById('desktop');
                const dw = desktop ? desktop.offsetWidth : 1200;
                const dh = desktop ? desktop.offsetHeight : 800;
                const dr = desktop ? desktop.getBoundingClientRect() : { left: 0, top: 0 };

                // Splice в убывающем порядке, чтобы индексы не поехали
                const sorted = Array.from(dragCIs).sort((a, b) => b - a);
                const movedItems: LinkItem[] = [];
                sorted.forEach(idx => {
                    const m = links[folderIndex] && links[folderIndex].items!.splice(idx, 1)[0];
                    if (m) movedItems.push(m);
                });

                // Разместить на столе в точке дропа (каждый следующий со смещением)
                movedItems.reverse().forEach((m, i) => {
                    let dropX = ev.clientX - dr.left + i * SNAP_TILE;
                    let dropY = ev.clientY - dr.top + i * SNAP_TILE;
                    dropX = Math.max(0, Math.min(dropX, dw - 80));
                    dropY = Math.max(0, Math.min(dropY, dh - 80));
                    // Каноническая сетка (snapPos), а не локальное округление
                    if (settings.snapToGrid) { const sp = snapPos(dropX, dropY); dropX = sp.x; dropY = sp.y; }
                    m[getPosKey()] = { x: dropX, y: dropY, dw: dw, dh: dh };
                    links.push(m);
                });

                selectedFolderItems.clear();
                refreshFolderWindow(folderIndex);
            }
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

export function openFolder(folderIndex: number): void {
    const folder = links[folderIndex];
    if (!folder) return;
    const winId = 'folder-' + folderIndex;
    if (wmWindows[winId]) { wmRestore(winId); wmFocus(winId); return; }

    const contentEl = el('div', { className: 'folder-window-content' });

    const selectedFolderItems = new Set<number>();
    let folderWin: FolderWinExt | null = null; // заполняется после wmCreate

    function updateFolderItemSelection(): void {
        contentEl.querySelectorAll<HTMLElement>('.folder-item:not(.add-item)').forEach(node => {
            const ci = parseInt(node.dataset.childIndex || '', 10);
            node.classList.toggle('selected', !isNaN(ci) && selectedFolderItems.has(ci));
        });
    }

    function renderFolderContent(): void {
        contentEl.innerHTML = '';
        folder.items!.forEach((child, ci) => {
            const item = el('div', { className: 'folder-item', dataset: { childIndex: String(ci) } });
            if (selectedFolderItems.has(ci)) item.classList.add('selected');
            const fav = child.customIcon || getFaviconUrl(child.url || '');
            item.innerHTML = '<img class="folder-item-icon" src="' + escapeHtml(fav) + '" alt=""><span class="folder-item-name">' + escapeHtml(child.name) + '</span>';
            item.addEventListener('click', (e: MouseEvent) => {
                const itemExt = item as HTMLElement & { _wasDragged?: boolean };
                if (itemExt._wasDragged) { itemExt._wasDragged = false; return; }
                if (e.ctrlKey) {
                    if (selectedFolderItems.has(ci)) selectedFolderItems.delete(ci);
                    else selectedFolderItems.add(ci);
                    updateFolderItemSelection();
                    return;
                }
                selectedFolderItems.clear();
                updateFolderItemSelection();
                navToUrl(child.url || '');
            });
            initFolderItemDrag(item, child, ci, folderIndex, () => folderWin, selectedFolderItems);
            contentEl.appendChild(item);
        });
        const ab = el('div', { className: 'folder-item add-item' });
        ab.innerHTML = '<span class="folder-add-plus">+</span><span class="folder-item-name">Добавить</span>';
        ab.addEventListener('click', () => { runAction(ACTION.addShortcut, { folderIndex }); });
        contentEl.appendChild(ab);
    }

    // Rubber-band выделение внутри окна папки
    contentEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.folder-item')) return;
        e.preventDefault();
        if (!e.ctrlKey) { selectedFolderItems.clear(); updateFolderItemSelection(); }
        const preSelection = new Set(selectedFolderItems);
        const cRect = contentEl.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;

        const rb = el('div', { className: 'folder-selection-rect' });
        rb.style.cssText = 'left:' + (sx - cRect.left + contentEl.scrollLeft) + 'px;top:' + (sy - cRect.top + contentEl.scrollTop) + 'px;width:0;height:0;';
        contentEl.appendChild(rb);

        function onMove(ev: MouseEvent): void {
            if (!rb.parentNode) return;
            const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY);
            const x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
            rb.style.left = (x1 - cRect.left + contentEl.scrollLeft) + 'px';
            rb.style.top = (y1 - cRect.top + contentEl.scrollTop) + 'px';
            rb.style.width = (x2 - x1) + 'px';
            rb.style.height = (y2 - y1) + 'px';
            selectedFolderItems.clear();
            preSelection.forEach(i => { selectedFolderItems.add(i); });
            contentEl.querySelectorAll<HTMLElement>('.folder-item:not(.add-item)').forEach(node => {
                const ci = parseInt(node.dataset.childIndex || '', 10);
                if (isNaN(ci)) return;
                const r = node.getBoundingClientRect();
                if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) selectedFolderItems.add(ci);
            });
            updateFolderItemSelection();
        }
        function onUp(): void {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (rb.parentNode) rb.remove();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    renderFolderContent();
    const win = wmCreate(winId, folder.name, contentEl, 480, 350, xpIconHtml('folder', 16));
    folderWin = win as FolderWinExt;
    if (folderWin) {
        folderWin._renderFolderContent = renderFolderContent;
        folderWin._folderIndex = folderIndex;
        folderWin._selectedFolderItems = selectedFolderItems;
        folderWin._updateFolderItemSelection = updateFolderItemSelection;
    }
}

export function refreshFolderWindow(folderIndex: number): void {
    saveLinks();
    const winId = 'folder-' + folderIndex;
    if (wmWindows[winId]) { wmClose(winId); openFolder(folderIndex); }
    renderDesktop();
}
