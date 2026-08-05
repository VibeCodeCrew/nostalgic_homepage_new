// DOOM: лаунчер iframe-приложения doom/ + проброс клавиатуры в игру.
// Порт DOOM (script.js:4877-4933).
// Полоска с переключателями «Звук»/«Музыка» над кадром живёт ВНУТРИ iframe
// (public/doom/index.html + doom.js, localStorage doom_audio_v1 = KEY_DOOM_AUDIO) —
// лаунчер её не строит, как и в оригинале (422 = 400 кадр игры + 22 полоска).

import './doom.css';
import { registerAction, ACTION } from '../../../core/actions';
import { xpIconHtml } from '../../../core/dom';
import {
    wmCreate, wmGet, wmRestore, wmFocus, wmResizeToContent, activeWindowId,
} from '../../../wm/windowManager';

export function openDoom(): void {
    if (wmGet('doom')) { wmRestore('doom'); wmFocus('doom'); return; }
    const c = document.createElement('div');
    c.className = 'doom-window';
    // Игра живёт в iframe: закрытие окна полностью выгружает WASM-инстанс,
    // повторное открытие — чистый запуск с титульного экрана
    c.innerHTML = '<iframe class="doom-frame" src="doom/index.html"></iframe>';
    wmCreate('doom', 'DOOM', c, 664, 482, xpIconHtml('doom', 16));
    // Подгоняем окно под кадр игры 640x400 + полоска управления сверху
    wmResizeToContent('doom', 640, 422, 480, 322, 1600, 1222);
    // Фокус — сразу внутрь iframe игры: иначе Пробел/Enter остаются на кнопках
    // родительской страницы (панель задач, ярлык) и «кликают» их
    if (document.activeElement) (document.activeElement as HTMLElement).blur();
    const doomFrame = c.querySelector('iframe');
    if (doomFrame) {
        doomFrame.focus();
        // Загрузка документа в iframe сбрасывает фокус — возвращаем
        doomFrame.addEventListener('load', () => { doomFrame.focus(); });
    }
}

// Проброс клавиатуры в iframe игры. Практика показала, что DOM-фокус
// ненадёжно остаётся на элементах родителя (кнопка панели задач и т.п.):
// тогда Пробел/Enter «кликают» её и окно сворачивается, а игра клавиш
// не видит. Поэтому пока окно DOOM активно, все клавиши дублируем в игру
// синтетическими событиями, а браузерные действия глушим. Если фокус и так
// внутри iframe, родитель событий не видит — двойной отработки нет.
function doomForwardKey(e: KeyboardEvent, type: 'keydown' | 'keyup'): void {
    const w = wmGet('doom');
    if (!w || w.minimized || activeWindowId !== 'doom') return;
    if (e.ctrlKey || e.metaKey) return; // браузерные шорткаты не трогаем
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const f = w.el.querySelector('iframe');
    if (!f || !f.contentDocument || !f.contentWindow) return;
    // Не даём клавишам сработать на кнопках/скролле родителя
    e.preventDefault();
    e.stopPropagation();
    // Конструктор берём из realm iframe (как в оригинале: new f.contentWindow.KeyboardEvent)
    const KeyEv = (f.contentWindow as unknown as Window & typeof globalThis).KeyboardEvent;
    const ev = new KeyEv(type, {
        key: e.key, code: e.code, location: e.location,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
        repeat: e.repeat, bubbles: true, cancelable: true,
    });
    // Emscripten читает legacy-свойства — конструктор их не принимает, ставим вручную
    // (defineProperty, а не присваивание: в strict mode запись в getter-only
    // свойство прототипа кинула бы TypeError — в оригинале скрипт нестрогий)
    Object.defineProperty(ev, 'keyCode', { value: e.keyCode });
    Object.defineProperty(ev, 'which', { value: e.which });
    Object.defineProperty(ev, 'charCode', { value: e.charCode });
    // SDL вешает обработчики на canvas — шлём туда (с bubbles дойдёт и до document)
    const target = f.contentDocument.getElementById('canvas') || f.contentDocument;
    target.dispatchEvent(ev);
}

let doomKeysBound = false;

export function initDoom(): void {
    registerAction(ACTION.openDoom, openDoom);
    // Глобальные capture-слушатели вешаются один раз (как в оригинале на уровне модуля)
    if (doomKeysBound) return;
    doomKeysBound = true;
    document.addEventListener('keydown', e => {
        if (activeWindowId === 'doom') doomForwardKey(e, 'keydown');
    }, true);
    document.addEventListener('keyup', e => {
        if (activeWindowId === 'doom') doomForwardKey(e, 'keyup');
    }, true);
}
