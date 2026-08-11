// Строка меню Mac OS X (существует только в теме macos) — порт script.js:1158-1276.

import { xpIconHtml } from '../../core/dom';
import { runAction, ACTION } from '../../core/actions';
import { updateSetting } from '../../core/state';
import { wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { showContextMenu, MENU_SEP } from '../contextmenu';
import { toggleCalendar } from '../tray/calendar';
import { getUpdateAvailable } from '../tray/updateBell';
import { updateClock } from '../tray/clock';
import { macIcon16 } from './dock';
import type { ContextMenuItem } from '../../core/types';

export function ensureMacMenuBar(): void {
    if (document.getElementById('mac-menubar')) return;
    const bar = document.createElement('div');
    bar.id = 'mac-menubar';

    // «Яблочное» меню: Mac-меню, не XP «Пуск»
    const apple = document.createElement('button');
    apple.className = 'mb-item mb-apple';
    apple.innerHTML = '<img src="icons/mac/apple.png" width="16" height="16" alt="">';
    apple.title = 'Меню';
    apple.setAttribute('aria-label', 'Меню');
    apple.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = apple.getBoundingClientRect();
        showContextMenu(r.left, r.bottom + 2, [
            { label: 'Об этом компьютере', action: () => runAction(ACTION.openSysInfo) },
            { label: 'Обновление ПО…', action: () => runAction(ACTION.checkUpdates) },
            { label: 'Системные настройки…', action: () => runAction(ACTION.openSettings) },
            MENU_SEP,
            { label: 'Программы', submenu: [
                { label: 'Сапёр',    icon: macIcon16('minesweeper'), action: () => runAction('app:minesweeper') },
                { label: 'Косынка',  icon: macIcon16('solitaire'),   action: () => runAction('app:solitaire') },
                { label: 'Червы',    icon: macIcon16('hearts'),      action: () => runAction('app:hearts') },
                { label: 'Пинбол',   icon: macIcon16('pinball'),     action: () => runAction(ACTION.openPinball) },
                { label: 'DOOM',     icon: macIcon16('doom'),        action: () => runAction(ACTION.openDoom) },
                MENU_SEP,
                { label: 'Блокнот',  icon: macIcon16('notepad'),     action: () => runAction('app:notepad') },
                { label: 'WordPad',  icon: macIcon16('wordpad'),     action: () => runAction('app:wordpad') },
                { label: 'Paint',    icon: macIcon16('paint'),       action: () => runAction('app:paint') },
                { label: 'Калькулятор', icon: macIcon16('calculator'), action: () => runAction('app:calculator') },
                { label: 'Командная строка', icon: macIcon16('cmd'), action: () => runAction('app:cmd') },
                { label: 'Стикер',   icon: macIcon16('stickies'),    action: () => runAction(ACTION.newSticky) },
            ] },
            MENU_SEP,
            { label: 'Завершить принудительно…', action: () => runAction(ACTION.openTaskmgr) },
            MENU_SEP,
            // Скринсейвер — отдельная фича, портируется позже (пока no-op с warning)
            { label: 'Сон', action: () => runAction('screensaver') },
            { label: 'Завершение работы…', action: () => runAction(ACTION.shutdown) },
        ]);
    });
    bar.appendChild(apple);

    // Меню «Вид» — реальные переключатели режимов и темы
    const view = document.createElement('button');
    view.className = 'mb-item';
    view.textContent = 'Вид';
    view.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = view.getBoundingClientRect();
        showContextMenu(r.left, r.bottom + 2, [
            { label: 'Плитки',    action: () => updateSetting('viewMode', 'glass') },
            { label: 'Миниатюры', action: () => updateSetting('viewMode', 'window') },
            { label: 'Ярлыки',    action: () => updateSetting('viewMode', 'icon') },
            MENU_SEP,
            { label: 'Тема: Windows XP', action: () => updateSetting('theme', 'xp') },
        ]);
    });
    bar.appendChild(view);

    // Меню «Окно» — динамический список открытых окон
    const win = document.createElement('button');
    win.className = 'mb-item';
    win.textContent = 'Окно';
    win.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = win.getBoundingClientRect();
        const ids = Object.keys(wmWindows);
        const items: ContextMenuItem[] = ids.length
            ? ids.map((id) => {
                const tEl = wmWindows[id].el.querySelector('.xp-titlebar-title');
                return { label: (tEl && tEl.textContent) || id,
                         action: () => { wmRestore(id); wmFocus(id); } };
            })
            : [{ label: 'Нет окон', disabled: true, action: () => { /* пустой пункт */ } }];
        showContextMenu(r.left, r.bottom + 2, items);
    });
    bar.appendChild(win);

    // Правая часть: индикатор обновления + часы
    const right = document.createElement('div');
    right.className = 'mb-right';

    const upd = document.createElement('span');
    upd.className = 'mb-item mb-update hidden';
    upd.id = 'mb-update';
    upd.title = 'Доступно обновление — нажмите для установки';
    upd.innerHTML = xpIconHtml('update', 16);
    if (getUpdateAvailable()) upd.classList.remove('hidden');
    upd.addEventListener('click', (e) => {
        e.stopPropagation();
        runAction(ACTION.checkUpdates);
    });
    right.appendChild(upd);

    const clock = document.createElement('span');
    clock.className = 'mb-item mb-clock';
    clock.id = 'mb-time';
    clock.title = 'Календарь';
    clock.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCalendar();
    });
    right.appendChild(clock);

    bar.appendChild(right);
    document.body.appendChild(bar);
    updateClock(); // сразу показать время в меню-баре
}

export function removeMacMenuBar(): void {
    const bar = document.getElementById('mac-menubar');
    if (bar) bar.remove();
}
