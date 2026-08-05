// WordPad — rich text редактор (execCommand), сохранение в localStorage.
// Порт WORDPAD (script.js:5913-5944).

import './wordpad.css';
import { el, xpIconHtml } from '../../../core/dom';
import { KEY_WORDPAD_CONTENT } from '../../../core/keys';
import { getStrOrNull, setItem } from '../../../core/store';
import { registerAction } from '../../../core/actions';
import { wmCreate, wmRestore, wmFocus, wmWindows } from '../../../wm/windowManager';

export function openWordPad(): void {
    if (wmWindows['wordpad']) { wmRestore('wordpad'); wmFocus('wordpad'); return; }
    const c = el('div', { className: 'wordpad-window' });
    c.innerHTML = '<div class="wordpad-toolbar"><select id="wp-font" style="font-size:11px;width:100px"><option>Arial</option><option>Times New Roman</option><option>Courier New</option><option>Georgia</option><option>Verdana</option></select><select id="wp-size" style="font-size:11px;width:50px"><option>10</option><option>12</option><option selected>14</option><option>18</option><option>24</option><option>36</option></select><button class="wp-btn" data-cmd="bold" title="Жирный"><b>B</b></button><button class="wp-btn" data-cmd="italic" title="Курсив"><i>I</i></button><button class="wp-btn" data-cmd="underline" title="Подчеркнуть"><u>U</u></button><span style="width:8px;display:inline-block"></span><button class="wp-btn" data-cmd="justifyLeft" title="По левому краю">&#9776;</button><button class="wp-btn" data-cmd="justifyCenter" title="По центру">&#9783;</button><button class="wp-btn" data-cmd="justifyRight" title="По правому краю">&#9777;</button><span style="width:8px;display:inline-block"></span><input type="color" id="wp-color" value="#000000" style="width:22px;height:22px;padding:0;border:1px solid #999;cursor:pointer" title="Цвет текста"><button class="xp-dialog-btn" id="wp-save" style="font-size:10px;margin-left:4px">Сохранить</button><button class="xp-dialog-btn" id="wp-load" style="font-size:10px">Загрузить</button></div><div class="wordpad-ruler"><div style="flex:1;height:2px;background:linear-gradient(90deg,#aaa 0,#aaa 1px,transparent 0) 0 0/8px 2px repeat-x"></div></div><div id="wp-editor" class="wordpad-editor" contenteditable="true" spellcheck="false"></div>';
    wmCreate('wordpad', 'WordPad', c, 640, 480, xpIconHtml('wordpad', 16));
    setTimeout(() => {
        const editor = document.getElementById('wp-editor');
        const fontSel = document.getElementById('wp-font') as HTMLSelectElement | null;
        const sizeSel = document.getElementById('wp-size') as HTMLSelectElement | null;
        const colorInp = document.getElementById('wp-color') as HTMLInputElement | null;
        if (!editor || !fontSel || !sizeSel || !colorInp) return;
        editor.style.fontFamily = 'Arial';
        editor.style.fontSize = '14px';
        const saved = getStrOrNull(KEY_WORDPAD_CONTENT);
        if (saved) editor.innerHTML = saved;

        c.querySelectorAll('.wp-btn').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                document.execCommand((btn as HTMLElement).dataset.cmd || '', false, undefined);
                editor.focus();
            });
        });
        fontSel.addEventListener('change', () => { document.execCommand('fontName', false, fontSel.value); editor.focus(); });
        sizeSel.addEventListener('change', () => {
            document.execCommand('fontSize', false, '3');
            editor.querySelectorAll('font[size="3"]').forEach(f => {
                f.removeAttribute('size');
                (f as HTMLElement).style.fontSize = sizeSel.value + 'px';
            });
            editor.focus();
        });
        colorInp.addEventListener('input', () => { document.execCommand('foreColor', false, colorInp.value); editor.focus(); });
        const saveBtn = document.getElementById('wp-save');
        if (saveBtn) saveBtn.addEventListener('click', () => { setItem(KEY_WORDPAD_CONTENT, editor.innerHTML); });
        const loadBtn = document.getElementById('wp-load');
        if (loadBtn) loadBtn.addEventListener('click', () => {
            const s = getStrOrNull(KEY_WORDPAD_CONTENT);
            if (s) editor.innerHTML = s;
        });
    }, 0);
}

export function initWordpad(): void {
    registerAction('app:wordpad', openWordPad);
}
