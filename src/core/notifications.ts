// Всплывающие уведомления (баллуны) в области трея.

import { el, escapeHtml } from './dom';
import { playSound } from './sound';

let balloonOffset = 0;

export function showNotification(title: string, text: string, icon = '💬', duration = 4000): void {
    playSound('notify');
    const node = el('div', {
        className: 'xp-balloon',
        style: 'bottom:' + (44 + balloonOffset) + 'px',
        html:
            '<div class="xp-balloon-head">' +
            '<span class="xp-balloon-icon">' + icon + '</span>' +
            '<span class="xp-balloon-title">' + escapeHtml(title) + '</span>' +
            '</div>' +
            '<div class="xp-balloon-text">' + escapeHtml(text) + '</div>' +
            '<span class="xp-balloon-close">✕</span>',
    });
    balloonOffset += 72;
    document.body.appendChild(node);

    let removed = false;
    function remove(): void {
        if (removed) return;
        removed = true;
        balloonOffset = Math.max(0, balloonOffset - 72);
        node.style.opacity = '0';
        node.style.transition = 'opacity 0.2s';
        setTimeout(() => { node.parentNode && node.remove(); }, 220);
    }
    node.querySelector('.xp-balloon-close')!.addEventListener('click', remove);
    setTimeout(remove, duration);
}

// Уведомление о переполнении localStorage (подписка — в main.ts).
export function notifyStorageQuota(key: string): void {
    showNotification(
        'Недостаточно места',
        'Не удалось сохранить данные (' + key + '): локальное хранилище переполнено. Удалите часть ярлыков или скриншотов.',
        '⚠️',
        8000,
    );
}
