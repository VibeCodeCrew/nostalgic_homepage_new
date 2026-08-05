// Панель задач: кнопка «Пуск» и Quick Launch — порт биндингов script.js:8373, 8517-8523.
// (Базовые стили таскбара 422-503 уже перенесены в wm/windowManager.css — не дублируем.)

import './taskbar.css';
import { runAction, ACTION } from '../../core/actions';
import { toggleStartMenu } from '../startmenu';

/** Биндинги Quick Launch (CSP-safe: без inline onclick) и кнопки «Пуск». */
export function initTaskbar(): void {
    // Кнопка «Пуск» — toggle меню
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleStartMenu(); });

    const bindings: Array<[string, () => void]> = [
        ['ql-newtab',     () => { chrome.tabs.create({}); }],
        ['ql-search',     () => runAction(ACTION.openSearch)],
        ['ql-mycomputer', () => runAction(ACTION.openMyComputer)],
        ['ql-notepad',    () => runAction('app:notepad')],
        ['ql-sticky',     () => runAction(ACTION.newSticky)],
    ];
    bindings.forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    });
}
