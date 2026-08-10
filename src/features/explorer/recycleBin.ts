// Корзина — порт RECYCLE BIN (script.js:4330-4350).

import { el, escapeHtml, xpIconHtml } from '../../core/dom';
import { emit } from '../../core/events';
import { links, saveTrash, setTrashedLinks, trashedLinks } from '../../core/state';
import { wmCreate, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { saveAndRender } from '../desktop';
import { refreshDockTrash } from '../themes';

export function openRecycleBin(): void {
    if (wmWindows['recycle']) { wmRestore('recycle'); wmFocus('recycle'); return; }
    const c = el('div', { className: 'recycle-window' });

    function rend(): void {
        c.innerHTML = '';
        if (!trashedLinks.length) {
            c.innerHTML = '<div class="empty-bin">Корзина пуста</div>';
            return;
        }
        trashedLinks.forEach((item, i) => {
            const row = el('div', { className: 'recycle-item' });
            const trashed = item as typeof item & { deletedAt?: number };
            row.innerHTML = '<span class="recycle-name">' + escapeHtml(item.name) + '</span><span class="recycle-date">' + (trashed.deletedAt ? new Date(trashed.deletedAt).toLocaleString('ru-RU') : '') + '</span>';
            const rb = el('button', { className: 'xp-dialog-btn', text: 'Восстановить' });
            rb.addEventListener('click', () => {
                const r = trashedLinks.splice(i, 1)[0] as typeof item & { deletedAt?: number };
                delete r.deletedAt;
                links.push(r);
                saveTrash();
                saveAndRender();
                rend();
                emit('clippy-react', { category: 'react_restore_from_trash', anim: 'wave', duration: 3000, delay: 200 });
            });
            const db = el('button', { className: 'xp-dialog-btn', text: 'Удалить' });
            db.addEventListener('click', () => {
                trashedLinks.splice(i, 1);
                saveTrash();
                refreshDockTrash();
                rend();
            });
            row.appendChild(rb);
            row.appendChild(db);
            c.appendChild(row);
        });
        const cb = el('button', { className: 'xp-dialog-btn', text: 'Очистить корзину', style: 'margin:8px;display:block' });
        cb.addEventListener('click', () => {
            setTrashedLinks([]);
            saveTrash();
            rend();
        });
        c.appendChild(cb);
    }
    rend();
    wmCreate('recycle', 'Корзина', c, 520, 340, xpIconHtml('recycle-bin', 16));
}
