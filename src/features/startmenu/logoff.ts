// «Завершение сеанса» (Log Off) — диалог в стиле XP.
// В нашей реальности «смена пользователя» = смена имени/рисунка учётной записи.

import { el, xpIconHtml } from '../../core/dom';
import { wmClose, wmCreate } from '../../wm/windowManager';
import { openAvatarPicker } from './avatarPicker';

export function openLogoffDialog(): void {
    const winId = 'logoff';
    wmClose(winId);
    const c = el('div', { className: 'shutdown-dialog' });
    c.innerHTML =
        '<div style="font-size:24px">🔑</div>' +
        '<div class="shutdown-text"><b>Завершение сеанса</b><p>Смена пользователя позволит выбрать другое имя и рисунок учётной записи.</p></div>';
    const bd = el('div', { className: 'dialog-btns' });
    const switchBtn = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'Сменить пользователя' });
    const cancelBtn = el('button', { className: 'xp-dialog-btn', text: 'Отмена' });
    bd.appendChild(switchBtn);
    bd.appendChild(cancelBtn);
    c.appendChild(bd);
    wmCreate(winId, 'Завершение сеанса', c, 340, 190, xpIconHtml('user', 16));
    switchBtn.addEventListener('click', () => {
        wmClose(winId);
        openAvatarPicker();
    });
    cancelBtn.addEventListener('click', () => { wmClose(winId); });
}
