// Блокнот — черновик с автосохранением (edge_notepad).
// Порт NOTEPAD (script.js:4413-4441).

import { el, xpIconHtml } from '../../../core/dom';
import { emit } from '../../../core/events';
import { STORAGE } from '../../../core/keys';
import { getStr, setItem } from '../../../core/store';
import { debounce } from '../../../core/debounce';
import { registerAction } from '../../../core/actions';
import { wmCreate, wmGet, wmRestore, wmFocus, wmWindows } from '../../../wm/windowManager';

export function openNotepad(): void {
    if (wmWindows['notepad']) { wmRestore('notepad'); wmFocus('notepad'); return; }
    const saved = getStr(STORAGE.notepad, '');
    const c = el('div', { className: 'notepad-window' });
    const mb = el('div', { className: 'notepad-menubar' });
    const fb = el('div', { className: 'notepad-menu-item', text: 'Файл' });
    const fm = el('div', { className: 'notepad-dropdown hidden', style: 'position:absolute' });
    const menuItems: Array<[string, number]> = [['Новый', 0], ['Сохранить', 1], ['Открыть сохранённое', 2]];
    menuItems.forEach(p => {
        const a = el('div', { className: 'notepad-menu-action', text: p[0] });
        a.dataset.action = String(p[1]);
        fm.appendChild(a);
    });
    mb.appendChild(fb);
    mb.appendChild(fm);
    const ta = el('textarea', { className: 'notepad-textarea', value: saved });
    ta.spellcheck = false;
    const sb = el('div', { className: 'notepad-statusbar', text: 'Строка: 1 | Столбец: 1' });
    c.appendChild(mb);
    c.appendChild(ta);
    c.appendChild(sb);
    wmCreate('notepad', 'Блокнот', c, 560, 400, xpIconHtml('notepad', 16));

    // Фикс аудита: автосохранение черновика при вводе (debounce 300мс)
    const autosave = debounce(() => { setItem(STORAGE.notepad, ta.value); }, 300);
    ta.addEventListener('input', autosave);

    let notepadLongShown = false;
    ta.addEventListener('keyup', () => {
        const b = ta.value.substr(0, ta.selectionStart).split('\n');
        sb.textContent = 'Строка: ' + b.length + ' | Столбец: ' + (b[b.length - 1].length + 1);
        // Реакция Скрепки на 500+ символов (один раз за открытие окна)
        if (!notepadLongShown && ta.value.length >= 500) {
            notepadLongShown = true;
            emit('clippy-react', { category: 'react_notepad_long', anim: 'talk', duration: 6000 });
        }
    });
    fb.addEventListener('click', e => {
        e.stopPropagation();
        fm.classList.toggle('hidden');
    });
    fm.addEventListener('click', e => {
        const a = (e.target as HTMLElement).closest('.notepad-menu-action') as HTMLElement | null;
        if (!a) return;
        fm.classList.add('hidden');
        const act = parseInt(a.dataset.action || '0', 10);
        if (act === 0) ta.value = '';
        else if (act === 1) setItem(STORAGE.notepad, ta.value);
        else ta.value = getStr(STORAGE.notepad, '');
    });
    const onDocClick = (e: MouseEvent): void => {
        if (!fm.contains(e.target as Node) && e.target !== fb) fm.classList.add('hidden');
    };
    document.addEventListener('click', onDocClick);
    // Фикс утечки: глобальный слушатель снимаем при закрытии окна
    const w = wmGet('notepad');
    if (w) {
        w.onClose = () => { document.removeEventListener('click', onDocClick); };
    }
}

export function initNotepad(): void {
    registerAction('app:notepad', openNotepad);
}
