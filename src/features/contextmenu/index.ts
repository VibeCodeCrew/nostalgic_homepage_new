// Движок контекстного меню XP: showContextMenu/hideContextMenu.
// Порт секции CONTEXT MENU ENGINE оригинального script.js (~2657-2694).
// ФИКС АУДИТА #2: label пунктов прогоняется через escapeHtml —
// в оригинале item.label вставлялся сырым innerHTML (XSS через имя ярлыка).
//
// Два уровня меню: основное (#context-menu) и оверлей (#context-menu-overlay).
// Оверлей открывается по правому клику на пункте меню (onContextMenu) — родительское
// меню при этом НЕ закрывается: пользователь видит, какой пункт вызван (подсветка
// ctx-active). Любое действие/клик вне — hideContextMenu закрывает оба уровня.

import { el, escapeHtml } from '../../core/dom';
import type { ContextMenuItem } from '../../core/types';
import './contextmenu.css';

/** Сепаратор меню (в оригинале — строка 'sep' в массиве пунктов). */
export const MENU_SEP: ContextMenuItem = { separator: true };

// Когда true — следующий showContextMenu уйдёт в оверлей, не трогая основное меню
let nextMenuIsOverlay = false;
// Подсвеченный пункт, открывший оверлей (для снятия подсветки при закрытии)
let overlaySourceItem: HTMLElement | null = null;

function menuEl(): HTMLElement {
    // Элемент всегда есть в index.html; ленивый поиск — модуль может грузиться до DOMContentLoaded
    const node = document.getElementById('context-menu');
    if (!node) throw new Error('[XP] элемент #context-menu не найден в DOM');
    return node;
}

function overlayEl(): HTMLElement {
    let node = document.getElementById('context-menu-overlay');
    if (!node) {
        node = el('div', { id: 'context-menu-overlay', className: 'xp-context-menu hidden' });
        document.body.appendChild(node);
    }
    return node;
}

export function hideContextMenu(): void {
    const m = document.getElementById('context-menu');
    if (m) {
        m.classList.add('hidden');
        m.classList.remove('sm-cascade'); // сброс модификатора флаиута «Все программы»
    }
    const ov = document.getElementById('context-menu-overlay');
    if (ov) ov.classList.add('hidden');
    if (overlaySourceItem) {
        overlaySourceItem.classList.remove('ctx-active');
        overlaySourceItem = null;
    }
}

function iconSpan(item: ContextMenuItem): HTMLElement {
    const span = el('span', { className: 'ctx-icon' });
    if (item.iconEl) span.appendChild(item.iconEl);
    else if (item.icon) span.innerHTML = item.icon;
    return span;
}

// Правый клик по пункту меню: контекстное меню «второго уровня» (оверлей).
// Родительское меню НЕ закрывается — пункт остаётся подсвеченным (ctx-active).
function bindItemContextMenu(node: HTMLElement, item: ContextMenuItem): void {
    if (!item.onContextMenu) return;
    node.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Прежний оверлей, если был, закрываем; основное меню оставляем
        const ov = document.getElementById('context-menu-overlay');
        if (ov) ov.classList.add('hidden');
        if (overlaySourceItem) overlaySourceItem.classList.remove('ctx-active');
        overlaySourceItem = node;
        node.classList.add('ctx-active');
        nextMenuIsOverlay = true;
        item.onContextMenu!(e.clientX, e.clientY);
        nextMenuIsOverlay = false; // страховка: флаг одноразовый
    });
}

function buildItem(item: ContextMenuItem): HTMLElement {
    // Пункт с подменю
    if (item.submenu) {
        const wrap = el('div', {
            className: 'xp-ctx-item xp-ctx-has-submenu',
            style: 'position:relative',
        });
        wrap.appendChild(iconSpan(item));
        wrap.appendChild(el('span', { html: escapeHtml(item.label || '') }));
        wrap.appendChild(el('span', { className: 'ctx-arrow', html: '&#9658;' }));
        const sub = el('div', { className: 'xp-submenu hidden' });
        item.submenu.forEach(si => {
            if (si.separator) { sub.appendChild(el('div', { className: 'xp-ctx-separator' })); return; }
            const se = el('div', {
                className: 'xp-ctx-item' + (si.checked ? ' ctx-check' : ''),
            });
            se.appendChild(iconSpan(si));
            se.appendChild(el('span', { html: escapeHtml(si.label || '') }));
            se.addEventListener('click', () => { hideContextMenu(); si.action?.(); });
            bindItemContextMenu(se, si);
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
    });
    node.appendChild(iconSpan(item));
    node.appendChild(el('span', { html: escapeHtml(item.label || '') }));
    if (!item.disabled) {
        node.addEventListener('click', () => { hideContextMenu(); item.action?.(); });
    }
    bindItemContextMenu(node, item);
    return node;
}

export function showContextMenu(x: number, y: number, items: ContextMenuItem[], modifierClass?: string): void {
    const m = nextMenuIsOverlay ? overlayEl() : menuEl();
    nextMenuIsOverlay = false;
    m.className = 'xp-context-menu'; // сброс модификаторов прошлых показов
    if (m.id === 'context-menu-overlay') m.classList.add('xp-context-overlay');
    if (modifierClass) m.classList.add(modifierClass);
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
