// Пинбол (Space Cadet): лаунчер iframe-приложения pinball/. Порт PINBALL (script.js:4856-4876).
// Пинбол — отдельная страница pinball/ (canvas-игра «Космический Дед»),
// открывается в iframe-окне, как DOOM: изоляция от монолита, закрытие окна =
// чистая выгрузка игры. Управление внутри игры: Shift/Z и «/»/M — флипперы,
// удержание Пробела — плунжер, R — заново, P — пауза.

import './pinball.css';
import { registerAction, ACTION } from '../../../core/actions';
import { xpIconHtml } from '../../../core/dom';
import { wmCreate, wmGet, wmRestore, wmFocus } from '../../../wm/windowManager';

export function openPinball(): void {
    if (wmGet('pinball')) { wmRestore('pinball'); wmFocus('pinball'); return; }
    const c = document.createElement('div');
    c.className = 'pinball-window';
    c.innerHTML = '<iframe class="pinball-frame" src="pinball/index.html"></iframe>';
    wmCreate('pinball', 'Пинбол', c, 500, 680, xpIconHtml('pinball', 16));
    // Фокус — сразу внутрь iframe игры: иначе Пробел остаётся на кнопках
    // родительской страницы и «кликает» их (как у DOOM)
    if (document.activeElement) (document.activeElement as HTMLElement).blur();
    const pbFrame = c.querySelector('iframe');
    if (pbFrame) {
        pbFrame.focus();
        pbFrame.addEventListener('load', () => { pbFrame.focus(); });
    }
}

export function initPinball(): void {
    registerAction(ACTION.openPinball, openPinball);
}
