// Движок контекстного меню XP: showContextMenu/hideContextMenu.
// Порт секции CONTEXT MENU ENGINE оригинального script.js (~2657-2694).
// ФИКС АУДИТА #2: label пунктов прогоняется через escapeHtml —
// в оригинале item.label вставлялся сырым innerHTML (XSS через имя ярлыка).

import { el, escapeHtml } from '../../core/dom';
import type { ContextMenuItem } from '../../core/types';
import './contextmenu.css';

function menuEl(): HTMLElement {
    // Элемент всегда есть в index.html; ленивый поиск — модуль может грузиться до DOMContentLoaded
    const node = document.getElementById('context-menu');
    if (!node) throw new Error('[XP] элемент #context-menu не найден в DOM');
    return node;
}

export function hideContextMenu(): void {
    const m = document.getElementById('context-menu');
    if (m) m.classList.add('hidden');
}

function buildItem(item: ContextMenuItem): HTMLElement {
    // Пункт с подменю
    if (item.submenu) {
        const wrap = el('div', {
            className: 'xp-ctx-item xp-ctx-has-submenu',
            style: 'position:relative',
            html: '<span class="ctx-icon">' + (item.icon || '') + '</span><span>' + escapeHtml(item.label || '') + '</span><span class="ctx-arrow">&#9658;</span>',
        });
        const sub = el('div', { className: 'xp-submenu hidden' });
        item.submenu.forEach(si => {
            if (si.separator) { sub.appendChild(el('div', { className: 'xp-ctx-separator' })); return; }
            const se = el('div', {
                className: 'xp-ctx-item' + (si.checked ? ' ctx-check' : ''),
                html: '<span class="ctx-icon">' + (si.icon || '') + '</span><span>' + escapeHtml(si.label || '') + '</span>',
            });
            se.addEventListener('click', () => { hideContextMenu(); si.action?.(); });
            sub.appendChild(se);
        });
        wrap.appendChild(sub);
        wrap.addEventListener('mouseenter', () => {
            sub.classList.remove('hidden');
            const r = wrap.getBoundingClientRect();
            sub.style.left = r.width + 'px';
            sub.style.top = '0';
        });
        wrap.addEventListener('mouseleave', () => { sub.classList.add('hidden'); });
        return wrap;
    }
    // Обычный пункт
    const node = el('div', {
        className: 'xp-ctx-item' + (item.danger ? ' ctx-danger' : '') + (item.disabled ? ' ctx-disabled' : '') + (item.checked ? ' ctx-check' : ''),
        html: '<span class="ctx-icon">' + (item.icon || '') + '</span><span>' + escapeHtml(item.label || '') + '</span>',
    });
    if (!item.disabled) {
        node.addEventListener('click', () => { hideContextMenu(); item.action?.(); });
    }
    return node;
}

export function showContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    const m = menuEl();
    m.innerHTML = '';
    items.forEach(item => {
        if (item.separator) { m.appendChild(el('div', { className: 'xp-ctx-separator' })); return; }
        m.appendChild(buildItem(item));
    });
    m.classList.remove('hidden');
    const mw = m.offsetWidth || 220, mh = m.offsetHeight || 160;
    let px = x, py = y;
    if (px + mw > window.innerWidth) px = window.innerWidth - mw - 4;
    if (py + mh > window.innerHeight - 44) py = window.innerHeight - mh - 44;
    if (px < 0) px = 0; if (py < 0) py = 0;
    m.style.left = px + 'px'; m.style.top = py + 'px';
}
