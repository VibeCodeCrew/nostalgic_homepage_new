// Виджет поиска на рабочем столе (режимы window/icon) — порт SEARCH HELPERS
// (script.js:227-347). ФИКС АУДИТА: автокомплит уничтожается вместе с виджетом.

import { el } from '../../core/dom';
import { STORAGE } from '../../core/keys';
import { safeParse, setItem, setJSON } from '../../core/store';
import { settings, updateSetting } from '../../core/state';
import { attachSearchAutocomplete, AutocompleteHandle } from './autocomplete';
import { navToUrl } from './index';

export function searchUrlFor(engine: string, q: string): string {
    if (engine === 'go') return 'https://www.google.com/search?q=' + encodeURIComponent(q);
    return 'https://yandex.ru/search/?text=' + encodeURIComponent(q);
}

export function clampSearchWidget(widget: HTMLElement): void {
    const desktop = document.getElementById('desktop');
    if (!desktop || !widget) return;
    const cw = desktop.offsetWidth, ch = desktop.offsetHeight;
    const w = widget.offsetWidth || 360, h = widget.offsetHeight || 40;
    let l = parseInt(widget.style.left, 10);
    let t = parseInt(widget.style.top, 10);
    if (isNaN(l) || isNaN(t)) return; // позиция по умолчанию (top-center через CSS) — кламп не нужен
    l = Math.max(0, Math.min(l, cw - w));
    t = Math.max(0, Math.min(t, ch - h));
    widget.style.left = l + 'px';
    widget.style.top = t + 'px';
}

export function ensureSearchWidget(): void {
    const existing = document.getElementById('desktop-search-widget');
    const show = settings.searchWidget && (settings.viewMode === 'window' || settings.viewMode === 'icon');
    if (!show) {
        if (existing) destroySearchWidget(existing);
        return;
    }
    if (existing) { clampSearchWidget(existing); return; }
    createSearchWidget();
}

/** Полное удаление виджета: узел + автокомплит + слушатели. */
function destroySearchWidget(widget: HTMLElement): void {
    const ac = (widget as HTMLElement & { _ac?: AutocompleteHandle })._ac;
    if (ac) ac.destroy();
    widget.remove();
}

function createSearchWidget(): void {
    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;
    const desktop = desktopEl;
    const node = el('div', { id: 'desktop-search-widget' });
    const handle = el('div', { className: 'dsw-handle', title: 'Перетащить' });
    const inp = el('input', { type: 'text', className: 'dsw-input', placeholder: 'Введите запрос или адрес…' }) as HTMLInputElement;
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    const yB = el('button', { className: 'dsw-btn dsw-ya', text: 'Я', title: 'Поиск в Яндекс' });
    const gB = el('button', { className: 'dsw-btn dsw-go', text: 'G', title: 'Поиск в Google' });
    const cB = el('button', { className: 'dsw-close', text: '✕', title: 'Скрыть (можно вернуть в настройках)' });
    cB.setAttribute('aria-label', 'Скрыть поиск');
    node.appendChild(handle); node.appendChild(inp); node.appendChild(yB); node.appendChild(gB); node.appendChild(cB);

    // Восстановить сохранённую позицию (после первого drag) или CSS-дефолт (top-center)
    const saved = safeParse<{ x?: number; y?: number } | null>(localStorage.getItem(STORAGE.searchWidgetPos), null);
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        node.style.left = saved.x + 'px';
        node.style.top = saved.y + 'px';
        node.style.transform = 'none';
    }

    desktop.appendChild(node);
    clampSearchWidget(node);

    function go(engine: string): void {
        const q = inp.value.trim();
        if (!q) return;
        navToUrl(searchUrlFor(engine, q));
    }
    yB.addEventListener('click', () => go('ya'));
    gB.addEventListener('click', () => go('go'));

    // Закрытие — отключить виджет
    cB.addEventListener('click', () => {
        updateSetting('searchWidget', false);
        destroySearchWidget(node);
    });

    // Drag за ручку
    handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        const rect = node.getBoundingClientRect();
        const deskRect = desktop.getBoundingClientRect();
        const ox = rect.left - deskRect.left, oy = rect.top - deskRect.top;
        node.style.transform = 'none';
        node.style.left = ox + 'px';
        node.style.top = oy + 'px';
        handle.style.cursor = 'grabbing';
        function onM(ev: MouseEvent): void {
            const cw = desktop.offsetWidth, ch = desktop.offsetHeight;
            const w = node.offsetWidth, h = node.offsetHeight;
            const nx = Math.max(0, Math.min(cw - w, ox + ev.clientX - sx));
            const ny = Math.max(0, Math.min(ch - h, oy + ev.clientY - sy));
            node.style.left = nx + 'px';
            node.style.top = ny + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            handle.style.cursor = '';
            setJSON(STORAGE.searchWidgetPos, {
                x: parseInt(node.style.left, 10) || 0,
                y: parseInt(node.style.top, 10) || 0,
            });
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    // Автокомплит (destroy — в destroySearchWidget)
    (node as HTMLElement & { _ac?: AutocompleteHandle })._ac = attachSearchAutocomplete(inp, {
        onPick:   q => { navToUrl(searchUrlFor(settings.searchEngine, q)); },
        onSearch: q => { navToUrl(searchUrlFor(settings.searchEngine, q)); },
    });
}
