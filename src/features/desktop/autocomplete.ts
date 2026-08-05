// Автодополнение поисковых запросов (Google/Яндекс suggest) — порт
// attachSearchAutocomplete (script.js:349-437). ФИКС АУДИТА: destroy()
// обязателен при закрытии окна/удалении виджета (в оригинале не вызывался).

import { settings } from '../../core/state';

export interface AutocompleteOptions {
    onPick?: (q: string) => void;
    onSearch?: (q: string) => void;
}

export interface AutocompleteHandle {
    destroy: () => void;
}

export function fetchSuggestionsAsync(engine: string, q: string): Promise<string[]> {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage({ action: 'fetch_suggestions', engine: engine, q: q }, resp => {
                if (resp && resp.success) resolve(resp.items || []);
                else resolve([]);
            });
        } catch {
            resolve([]);
        }
    });
}

export function attachSearchAutocomplete(inputEl: HTMLInputElement, options: AutocompleteOptions = {}): AutocompleteHandle {
    const onPick = options.onPick || (() => {});
    const onSearch = options.onSearch || (() => {});
    const acEl = document.createElement('div');
    acEl.className = 'xp-search-ac';
    acEl.style.display = 'none';
    document.body.appendChild(acEl);
    let items: string[] = [];
    let focused = -1;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let reqSeq = 0;

    function position(): void {
        const r = inputEl.getBoundingClientRect();
        acEl.style.left = r.left + 'px';
        acEl.style.top = r.bottom + 'px';
        acEl.style.width = r.width + 'px';
    }
    function hide(): void { acEl.style.display = 'none'; items = []; focused = -1; }
    function render(list: string[]): void {
        acEl.innerHTML = '';
        items = list || [];
        focused = -1;
        if (!items.length) { hide(); return; }
        items.forEach((s, i) => {
            const row = document.createElement('div');
            row.className = 'xp-search-ac-item';
            row.textContent = s;
            row.addEventListener('mousedown', e => {
                e.preventDefault();
                inputEl.value = s;
                hide();
                onPick(s);
            });
            row.addEventListener('mouseenter', () => {
                focused = i;
                updateFocusUI();
            });
            acEl.appendChild(row);
        });
        position();
        acEl.style.display = '';
    }
    function updateFocusUI(): void {
        acEl.querySelectorAll('.xp-search-ac-item').forEach((r, j) => { r.classList.toggle('ac-focused', j === focused); });
    }
    function onInput(): void {
        const q = inputEl.value.trim();
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        if (!q) { hide(); return; }
        const mySeq = ++reqSeq;
        debounceTimer = setTimeout(() => {
            fetchSuggestionsAsync(settings.searchEngine, q).then(list => {
                if (mySeq !== reqSeq) return; // устаревший запрос
                render(list);
            });
        }, 180);
    }
    function onKey(e: KeyboardEvent): void {
        if (acEl.style.display === 'none' || !items.length) {
            if (e.key === 'Enter') { const q = inputEl.value.trim(); if (q) onSearch(q); }
            return;
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); focused = (focused + 1) % items.length; updateFocusUI(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focused = (focused - 1 + items.length) % items.length; updateFocusUI(); }
        else if (e.key === 'Enter') {
            if (focused >= 0) { e.preventDefault(); const s = items[focused]; inputEl.value = s; hide(); onPick(s); }
            else { const q2 = inputEl.value.trim(); if (q2) { hide(); onSearch(q2); } }
        } else if (e.key === 'Escape') { hide(); }
    }
    function onBlur(): void { setTimeout(hide, 150); }

    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKey);
    inputEl.addEventListener('blur', onBlur);
    window.addEventListener('resize', position);

    return {
        destroy: () => {
            if (debounceTimer !== null) clearTimeout(debounceTimer);
            inputEl.removeEventListener('input', onInput);
            inputEl.removeEventListener('keydown', onKey);
            inputEl.removeEventListener('blur', onBlur);
            window.removeEventListener('resize', position);
            if (acEl.parentNode) acEl.remove();
        },
    };
}
