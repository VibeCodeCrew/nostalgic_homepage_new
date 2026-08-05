// Диалог «Завершение работы Windows» — порт SHUTDOWN (script.js:4401-4412).

import { xpIconHtml } from '../../core/dom';
import { registerAction, ACTION } from '../../core/actions';
import { wmClose, wmCreate } from '../../wm/windowManager';

function openShutdownDialog(): void {
    wmClose('shutdown');
    const c = document.createElement('div'); c.className = 'shutdown-dialog';
    c.innerHTML = '<div style="font-size:24px">🪟</div><div class="shutdown-text"><b>Завершение работы Windows</b><p>Выберите действие:</p><select id="shutdown-select"><option value="close">Закрыть вкладку</option><option value="reload">Перезагрузить страницу</option></select></div><div class="dialog-btns"><button id="shutdown-ok" class="xp-dialog-btn xp-dialog-btn-primary">OK</button><button id="shutdown-cancel" class="xp-dialog-btn">Отмена</button></div>';
    wmCreate('shutdown', 'Завершение работы Windows', c, 320, 200, xpIconHtml('logout', 16));
    setTimeout(() => {
        document.getElementById('shutdown-ok')!.addEventListener('click', () => {
            const v = (document.getElementById('shutdown-select') as HTMLSelectElement).value;
            if (v === 'close') window.close(); else location.reload();
        });
        document.getElementById('shutdown-cancel')!.addEventListener('click', () => { wmClose('shutdown'); });
    }, 0);
}

export function initShutdown(): void {
    registerAction(ACTION.shutdown, openShutdownDialog);
}
