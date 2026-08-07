// Меню «Пуск»: открытие/закрытие, роутинг действий, шапка с именем/аватаром.
// Порт секции START MENU (script.js:3202-3313).

import './startmenu.css';
import { runAction, ACTION } from '../../core/actions';
import { registerAction } from '../../core/actions';
import { username, userAvatar } from '../../core/state';
import { on, emit } from '../../core/events';
import { openAllPrograms } from './allPrograms';
import { openAvatarPicker } from './avatarPicker';
import { resolveAvatarSrc } from './avatarPicker';
import { openSearch } from './search';
import { openRun } from './runDialog';
import { openTaskManager } from './taskManager';

export { openAvatarPicker } from './avatarPicker';
export { openSearch } from './search';
export { openRun } from './runDialog';
export { openTaskManager } from './taskManager';

let startMenuOpen = false;

export function isStartMenuOpen(): boolean {
    return startMenuOpen;
}

export function toggleStartMenu(): void {
    startMenuOpen = !startMenuOpen;
    const menu = document.getElementById('start-menu');
    const sb = document.getElementById('start-btn');
    if (!menu || !sb) return;
    if (startMenuOpen) {
        menu.classList.remove('hidden');
        sb.classList.add('active');
        sb.setAttribute('aria-expanded', 'true');
        emit('startmenu-opened'); // реакция Clippy — подписка в features/clippy
    } else {
        closeStartMenu();
    }
}

export function closeStartMenu(): void {
    const menu = document.getElementById('start-menu');
    const sb = document.getElementById('start-btn');
    if (menu) menu.classList.add('hidden');
    if (sb) {
        sb.classList.remove('active');
        sb.setAttribute('aria-expanded', 'false');
    }
    startMenuOpen = false;
    const ap = document.getElementById('sm-all-programs');
    if (ap) ap.classList.add('hidden');
}

function startMenuAction(a: string): void {
    if (a === 'allprograms') { openAllPrograms(); return; }
    closeStartMenu();
    switch (a) {
        case 'search':     runAction(ACTION.openSearch);     break;
        case 'notepad':    runAction('app:notepad');         break;
        case 'calculator': runAction('app:calculator');      break;
        case 'minesweeper':runAction('app:minesweeper');     break;
        case 'solitaire':  runAction('app:solitaire');       break;
        case 'hearts':     runAction('app:hearts');          break;
        case 'pinball':    runAction(ACTION.openPinball);    break;
        case 'paint':      runAction('app:paint');           break;
        case 'wordpad':    runAction('app:wordpad');         break;
        case 'cmd':        runAction('app:cmd');             break;
        case 'settings':   runAction(ACTION.openSettings);   break;
        case 'mycomputer': runAction(ACTION.openMyComputer); break;
        case 'run':        runAction(ACTION.openRun);        break;
        case 'taskmgr':    runAction(ACTION.openTaskmgr);    break;
        case 'stickies':   runAction(ACTION.newSticky);      break;
        case 'recycle':    runAction(ACTION.openRecycle);    break;
        case 'export':     runAction(ACTION.exportData);     break;
        case 'import':     document.getElementById('import-upload')?.click(); break;
        case 'update':     runAction(ACTION.checkUpdates);   break;
        case 'about':      runAction(ACTION.openSysInfo);    break;
        case 'shutdown':   runAction(ACTION.shutdown);       break;
        case 'logoff':     closeStartMenu(); openAvatarPicker(); break;
    }
}

/** Имя и аватар в шапке меню «Пуск». Вызывается при старте и по событию 'user-changed'. */
export function updateStartMenuUser(): void {
    const nameEl = document.querySelector('.sm-username');
    if (nameEl) nameEl.textContent = username;
    const img = document.getElementById('sm-avatar-img') as HTMLImageElement | null;
    if (img) resolveAvatarSrc(src => { img.src = src; });
}

export function initStartMenu(): void {
    // Делегирование кликов по пунктам меню (CSP-safe)
    const menu = document.getElementById('start-menu');
    if (menu) {
        menu.addEventListener('click', e => {
            const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
            if (item && menu.contains(item)) startMenuAction(item.dataset.action!);
        });
    }
    // Кнопка «Назад» панели «Все программы»
    const backBtn = document.querySelector('.sm-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('sm-all-programs')?.classList.add('hidden');
        });
    }
    // Клик вне меню — закрыть
    document.addEventListener('click', e => {
        if (!startMenuOpen) return;
        const target = e.target as HTMLElement;
        if (!target.closest('#start-menu') && !target.closest('#start-btn')) closeStartMenu();
    });
    // Клик по аватару в шапке — выбор рисунка (как logoff в оригинале)
    const avatar = document.querySelector('.sm-avatar');
    if (avatar) {
        (avatar as HTMLElement).style.cursor = 'pointer';
        avatar.addEventListener('click', () => { closeStartMenu(); openAvatarPicker(); });
    }

    updateStartMenuUser();
    on('user-changed', updateStartMenuUser);

    // Пункт «Все программы» доступен и как действие
    registerAction('open-all-programs', () => { openAllPrograms(); });
    // Системные утилиты
    registerAction(ACTION.openSearch, openSearch);
    registerAction(ACTION.openRun, openRun);
    registerAction(ACTION.openTaskmgr, openTaskManager);
}
