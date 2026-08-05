// Диалог «Выполнить» — порт RUN DIALOG (script.js:3546-3606).
// Автодополнение URL из chrome.history с debounce (фикс аудита: в оригинале
// поиск по истории дёргался на каждый input без debounce).

import { el, escapeHtml, xpIconHtml } from '../../core/dom';
import { debounce } from '../../core/debounce';
import { wmCreate, wmClose, wmWindows, wmRestore, wmFocus, wmGet } from '../../wm/windowManager';

export function openRun(): void {
    if (wmWindows['run']) { wmRestore('run'); wmFocus('run'); return; }
    const c = el('div', { className: 'dialog-form' });
    c.innerHTML = '<div style="font-family:Tahoma,sans-serif;font-size:11px;color:#333;margin-bottom:8px;">Введите адрес интернет-ресурса или программы:</div>';
    const fg = el('div', { className: 'form-group', html: '<label>Открыть:</label>' });
    const inp = el('input', { type: 'text', placeholder: 'https://...' }) as HTMLInputElement;
    fg.appendChild(inp);
    c.appendChild(fg);

    // Автодополнение из истории (паттерн xp-url-autocomplete)
    const acEl = el('div', { className: 'xp-url-autocomplete', style: 'display:none' });
    document.body.appendChild(acEl);
    let acItems: chrome.history.HistoryItem[] = [];
    let acFocused = -1;
    function acHide(): void { acEl.style.display = 'none'; acItems = []; acFocused = -1; }
    function acDestroy(): void { acEl.remove(); }
    function acPos(): void {
        const r = inp.getBoundingClientRect();
        acEl.style.left = r.left + 'px';
        acEl.style.top = r.bottom + 'px';
        acEl.style.width = r.width + 'px';
    }
    const searchHistory = debounce(() => {
        const q = inp.value.trim();
        if (!q) { acHide(); return; }
        if (typeof chrome === 'undefined' || !chrome.history) return;
        chrome.history.search({ text: q, maxResults: 6, startTime: 0 }, res => {
            acEl.innerHTML = '';
            acItems = res || [];
            acFocused = -1;
            acItems.forEach(h => {
                const row = el('div', { className: 'xp-url-ac-item' });
                const img = el('img', {
                    src: 'chrome-extension://' + chrome.runtime.id + '/_favicon/?pageUrl=' + encodeURIComponent(h.url || '') + '&size=16',
                    alt: '',
                });
                img.onerror = () => { img.style.visibility = 'hidden'; };
                row.appendChild(img);
                row.appendChild(el('span', { text: h.url || '' }));
                row.addEventListener('mousedown', e => { e.preventDefault(); inp.value = h.url || ''; acHide(); inp.focus(); });
                acEl.appendChild(row);
            });
            if (acItems.length) { acPos(); acEl.style.display = 'block'; } else acHide();
        });
    }, 180);
    inp.addEventListener('input', searchHistory);
    inp.addEventListener('keydown', e => {
        if (acEl.style.display === 'none') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const rows = acEl.querySelectorAll('.xp-url-ac-item');
            rows.forEach(r => r.classList.remove('ac-focused'));
            acFocused = Math.min(acFocused + 1, acItems.length - 1);
            if (rows[acFocused]) rows[acFocused].classList.add('ac-focused');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const rows = acEl.querySelectorAll('.xp-url-ac-item');
            rows.forEach(r => r.classList.remove('ac-focused'));
            acFocused = Math.max(acFocused - 1, 0);
            if (rows[acFocused]) rows[acFocused].classList.add('ac-focused');
        } else if (e.key === 'Enter' && acFocused >= 0) {
            inp.value = acItems[acFocused].url || '';
            acHide();
        } else if (e.key === 'Escape') { acHide(); }
    });
    inp.addEventListener('blur', () => { setTimeout(acHide, 150); });

    const bd = el('div', { className: 'dialog-btns' });
    const ok = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'OK' });
    const cn = el('button', { className: 'xp-dialog-btn', text: 'Отмена' });
    bd.appendChild(ok); bd.appendChild(cn); c.appendChild(bd);
    wmCreate('run', 'Выполнить', c, 360, 140, xpIconHtml('run', 16));
    setTimeout(() => inp.focus(), 50);
    ok.addEventListener('click', () => {
        acHide();
        let url = inp.value.trim();
        if (!url) return;
        if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(url)) url = 'https://' + url;
        acDestroy();
        window.open(url, '_blank');
        wmClose('run');
    });
    cn.addEventListener('click', () => { acDestroy(); wmClose('run'); });
    const w = wmGet('run');
    if (w) {
        w.onClose = acDestroy;
        w.el.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !(acEl.style.display === 'block' && acFocused >= 0)) ok.click();
            if (e.key === 'Escape') { acDestroy(); wmClose('run'); }
        });
    }
    void escapeHtml; // (импорт используется потенциальными правками; оставлен для единообразия)
}
