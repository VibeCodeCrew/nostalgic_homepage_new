// Плитки режима «Миниатюры» (XP-окна) и «Ярлыки» (классические иконки) —
// порт TILE MINIMIZE/RESTORE/OPEN + create*Icon* (script.js:1805-2001).

import { el, escapeHtml, xpIconHtml, getFaviconUrl } from '../../core/dom';
import { links, minimizedTiles, saveLinks, selectIcon, settings } from '../../core/state';
import { getIconDim } from './positioning';
import type { LinkItem } from '../../core/types';

// Колбэки от index.ts (избегаем циклического импорта на уровне модулей)
export interface TileDeps {
    openLinkItem: (item: LinkItem) => void;
    openFolder: (index: number) => void;
    trashLink: (index: number) => void;
    navToUrl: (url: string) => void;
}

let deps: TileDeps;

export function initTileDeps(d: TileDeps): void {
    deps = d;
}

// ==================== TILE MINIMIZE / RESTORE / OPEN ====================

export function tileMinimize(index: number, iconEl: HTMLElement): void {
    if (minimizedTiles.has(index)) return;
    iconEl.classList.add('tile-minimizing');
    setTimeout(() => {
        if (!document.body.contains(iconEl)) return;
        iconEl.style.display = 'none';
        iconEl.classList.remove('tile-minimizing');
        minimizedTiles.add(index);
        addTileTaskbarBtn(index);
    }, 190);
}

export function addTileTaskbarBtn(index: number): void {
    if (document.querySelector('.taskbar-tile-btn[data-tile-index="' + index + '"]')) return;
    const item = links[index];
    if (!item) return;
    const bar = document.getElementById('taskbar-windows');
    if (!bar) return;
    const btn = el('button', { className: 'taskbar-win-btn taskbar-tile-btn', dataset: { tileIndex: String(index) } });
    const favicon = item.customIcon || getFaviconUrl(item.url || '');
    btn.innerHTML =
        '<img src="' + escapeHtml(favicon) + '" style="width:14px;height:14px;object-fit:contain;flex-shrink:0" alt="">' +
        '<span class="taskbar-btn-title">' + escapeHtml(item.name) + '</span>';
    btn.addEventListener('click', () => { tileRestore(index); });
    bar.appendChild(btn);
}

export function tileRestore(index: number): void {
    minimizedTiles.delete(index);
    const iconEl = document.querySelector<HTMLElement>('.desktop-icon[data-index="' + index + '"]');
    if (iconEl) {
        iconEl.style.display = '';
        iconEl.classList.add('tile-restoring');
        setTimeout(() => { iconEl.classList.remove('tile-restoring'); }, 210);
    }
    const btn = document.querySelector('.taskbar-tile-btn[data-tile-index="' + index + '"]');
    if (btn) btn.remove();
}

function tileMaxOpen(iconEl: HTMLElement, url: string): void {
    iconEl.classList.add('tile-opening');
    setTimeout(() => { deps.navToUrl(url); }, 300);
}

// ==================== WINDOW MODE: link tile ====================

export function createLinkIconWindow(item: LinkItem, index: number): HTMLElement {
    const dim = getIconDim(item);
    const favicon = item.customIcon || getFaviconUrl(item.url || '');
    // Локальный скриншот; если его пока нет — фавиконка как заглушка
    const thumbSrc = item.screenshot || favicon;

    const icon = document.createElement('div');
    icon.className = 'desktop-icon link-icon xp-tile-window';
    icon.dataset.index = String(index);
    icon.style.width = dim.w + 'px';
    icon.style.position = 'absolute';

    const tb = el('div', { className: 'tile-titlebar' });
    tb.innerHTML =
        '<img class="tile-favicon" src="' + escapeHtml(favicon) + '" alt="">' +
        '<span class="tile-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span>' +
        '<div class="tile-btns">' +
          '<button class="tile-btn tile-btn-min" title="Свернуть">&#8211;</button>' +
          '<button class="tile-btn tile-btn-max" title="Открыть страницу">&#9633;</button>' +
          '<button class="tile-btn tile-btn-close" title="Убрать в корзину">&#x2715;</button>' +
        '</div>';

    const tc = el('div', { className: 'tile-content', style: 'height:' + ((item as { h?: number }).h || settings.tileHeight) + 'px' });
    const thumb = el('img', { className: 'icon-thumb', src: thumbSrc, alt: '' });
    thumb.loading = 'lazy';
    thumb.onerror = () => {
        tc.innerHTML = '<div class="thumb-fallback"><img src="' + escapeHtml(favicon) + '" alt=""></div>';
    };
    tc.appendChild(thumb);

    // Ресайз отдельной плитки
    const rh = el('div', { className: 'tile-resize-handle' });
    rh.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const sx = e.clientX, sy = e.clientY;
        const sw = icon.offsetWidth, sh = tc.offsetHeight;
        function onM(ev: MouseEvent): void {
            const nw = Math.max(80, sw + ev.clientX - sx);
            const nh = Math.max(50, sh + ev.clientY - sy);
            icon.style.width = nw + 'px';
            tc.style.height = nh + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            const ext = item as { w?: number; h?: number };
            ext.w = icon.offsetWidth;
            ext.h = tc.offsetHeight;
            saveLinks();
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    icon.appendChild(tb);
    icon.appendChild(tc);
    icon.appendChild(rh);

    const iconExt = icon as HTMLElement & { _wasDragged?: boolean };

    // Навигация: тайтлбар или превью (не кнопки, не ресайз)
    function navigate(e: MouseEvent): void {
        if (iconExt._wasDragged) { iconExt._wasDragged = false; return; }
        const target = e.target as HTMLElement;
        if (target.closest('.tile-btns') || target.closest('.tile-resize-handle')) return;
        if (e.ctrlKey) { selectIcon(index, true); return; }
        selectIcon(index, false);
        if (!settings.doubleClickOpen) deps.openLinkItem(item);
    }
    tb.addEventListener('click', navigate);
    tc.addEventListener('click', navigate);
    tb.addEventListener('dblclick', e => {
        const target = e.target as HTMLElement;
        if (settings.doubleClickOpen && !target.closest('.tile-btns') && !target.closest('.tile-resize-handle')) deps.openLinkItem(item);
    });
    tc.addEventListener('dblclick', e => {
        const target = e.target as HTMLElement;
        if (settings.doubleClickOpen && !target.closest('.tile-btns') && !target.closest('.tile-resize-handle')) deps.openLinkItem(item);
    });

    // Кнопки плитки
    tb.querySelector('.tile-btn-close')!.addEventListener('click', e => { e.stopPropagation(); deps.trashLink(index); });
    tb.querySelector('.tile-btn-min')!.addEventListener('click', e => { e.stopPropagation(); tileMinimize(index, icon); });
    tb.querySelector('.tile-btn-max')!.addEventListener('click', e => { e.stopPropagation(); tileMaxOpen(icon, item.url || ''); });
    tb.querySelector('.tile-btns')!.addEventListener('mousedown', e => { e.stopPropagation(); });

    return icon;
}

// В window-mode папки выглядят как классические XP-иконки папок
export function createFolderIconWindow(item: LinkItem, index: number): HTMLElement {
    return createFolderIconXP(item, index);
}

// ==================== ICON MODE: classic XP shortcut ====================

export function createLinkIconXP(item: LinkItem, index: number): HTMLElement {
    const favicon = item.customIcon || getFaviconUrl(item.url || '');
    const icon = document.createElement('div');
    icon.className = 'desktop-icon link-icon xp-icon';
    icon.dataset.index = String(index);
    icon.innerHTML =
        '<div class="xp-icon-img-wrapper">' +
          '<img class="xp-icon-favicon" src="' + escapeHtml(favicon) + '" alt="">' +
          // Стрелка ярлыка — только для ссылок, уходящих из вкладки;
          // веб-приложения (app) открываются внутри, как DOOM, — без стрелки
          (item.app ? '' : '<div class="xp-shortcut-arrow">&#8599;</div>') +
        '</div>' +
        '<span class="xp-icon-label">' + escapeHtml(item.name) + '</span>';

    const iconExt = icon as HTMLElement & { _wasDragged?: boolean };
    icon.addEventListener('click', e => {
        if (iconExt._wasDragged) { iconExt._wasDragged = false; return; }
        if (e.ctrlKey) { selectIcon(index, true); return; }
        selectIcon(index, false);
        if (!settings.doubleClickOpen) deps.openLinkItem(item);
    });
    icon.addEventListener('dblclick', () => {
        if (settings.doubleClickOpen) deps.openLinkItem(item);
    });
    return icon;
}

// ==================== ICON MODE: folder ====================

export function createFolderIconXP(item: LinkItem, index: number): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'desktop-icon folder-icon xp-icon';
    icon.dataset.index = String(index);
    icon.innerHTML =
        '<div class="xp-icon-img-wrapper">' + xpIconHtml('folder', 48) + '</div>' +
        '<span class="xp-icon-label">' + escapeHtml(item.name) + '</span>';

    const iconExt = icon as HTMLElement & { _wasDragged?: boolean };
    icon.addEventListener('click', e => {
        if (iconExt._wasDragged) { iconExt._wasDragged = false; return; }
        if (e.ctrlKey) { selectIcon(index, true); return; }
        selectIcon(index, false);
        if (!settings.doubleClickOpen) deps.openFolder(index);
    });
    icon.addEventListener('dblclick', () => {
        if (settings.doubleClickOpen) deps.openFolder(index);
    });
    return icon;
}
