// Окно «Поиск» — порт SEARCH (script.js:3426-3444).

import { el, xpIconHtml } from '../../core/dom';
import { settings } from '../../core/state';
import { wmCreate, wmWindows, wmRestore, wmFocus, wmGet } from '../../wm/windowManager';
import { searchUrlFor } from '../desktop/searchWidget';
import { attachSearchAutocomplete } from '../desktop/autocomplete';

export function openSearch(): void {
    if (wmWindows['search']) { wmRestore('search'); wmFocus('search'); return; }
    const c = el('div', { className: 'search-window' });
    const f = el('div', { className: 'search-form', html: '<label>Поиск в интернете:</label>' });
    const inp = el('input', { type: 'text', placeholder: 'Введите запрос...' }) as HTMLInputElement;
    inp.autocomplete = 'off';
    const bd = el('div', { className: 'search-btns' });
    const yB = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'Яндекс' });
    const gB = el('button', { className: 'xp-dialog-btn', text: 'Google' });
    bd.appendChild(yB); bd.appendChild(gB);
    f.appendChild(inp); f.appendChild(bd); c.appendChild(f);
    const win = wmCreate('search', 'Поиск', c, 380, 155, xpIconHtml('search', 16));

    function go(engine: string): void {
        const q = inp.value.trim();
        if (!q) return;
        window.open(searchUrlFor(engine, q), '_blank');
    }
    yB.addEventListener('click', () => go('ya'));
    gB.addEventListener('click', () => go('go'));
    const ac = attachSearchAutocomplete(inp, {
        onPick:   q => { inp.value = q; window.open(searchUrlFor(settings.searchEngine, q), '_blank'); },
        onSearch: q => { window.open(searchUrlFor(settings.searchEngine, q), '_blank'); },
    });
    // ФИКС АУДИТА: destroy автокомплита при закрытии окна (в оригинале утекал)
    const w = wmGet('search');
    if (w) w.onClose = () => ac.destroy();
    void win;
    setTimeout(() => inp.focus(), 50);
}
