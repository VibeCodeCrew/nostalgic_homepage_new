// Меню «Пуск»: открытие/закрытие, роутинг действий, шапка с именем/аватаром.
// «Все программы» — каскадный флаиут вправо (как в настоящем XP), MRU — настоящий.

import './startmenu.css';
import { runAction, ACTION } from '../../core/actions';
import { registerAction } from '../../core/actions';
import { username } from '../../core/state';
import { on, emit } from '../../core/events';
import { xpIconHtml } from '../../core/dom';
import { openAllProgramsCascade, setCascadeCloser } from './allPrograms';
import { openAvatarPicker } from './avatarPicker';
import { resolveAvatarSrc } from './avatarPicker';
import { openSearch } from './search';
import { openRun } from './runDialog';
import { openTaskManager } from './taskManager';
import { openLogoffDialog } from './logoff';
import { initMru, renderMru } from './mru';
import { hideContextMenu, showContextMenu } from '../contextmenu';

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
        renderMru();
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
    hideContextMenu(); // закрыть каскад «Все программы» вместе с меню
}

function openCascadeNow(): void {
    const btn = document.querySelector<HTMLElement>('.sm-allprograms-btn');
    if (!btn) return;
    // Повторный клик — закрыть (toggle, как в Windows)
    const cm = document.getElementById('context-menu');
    if (cm && cm.classList.contains('sm-cascade') && !cm.classList.contains('hidden')) {
        hideContextMenu();
        return;
    }
    openAllProgramsCascade(btn);
}

function startMenuAction(a: string): void {
    if (a === 'allprograms') { openCascadeNow(); return; }
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
        case 'logoff':     openLogoffDialog();               break;
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
    // Закрытие меню перед запуском пункта каскада
    setCascadeCloser(closeStartMenu);

    // Делегирование кликов по пунктам меню (CSP-safe)
    const menu = document.getElementById('start-menu');
    if (menu) {
        menu.addEventListener('click', e => {
            const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
            if (!item || !menu.contains(item)) return;
            // «Все программы»: не даём document-обработчику «клик вне меню» (features/contextmenu)
            // тут же закрыть только что открытый каскад
            if (item.dataset.action === 'allprograms') e.stopPropagation();
            startMenuAction(item.dataset.action!);
        });
    }

    // «Все программы»: каскад открывается по КЛИКУ (через делегирование data-action),
    // hover-открытие отключено по требованию UX.

    // Клик вне меню — закрыть
    document.addEventListener('click', e => {
        if (!startMenuOpen) return;
        const target = e.target as HTMLElement;
        if (!target.closest('#start-menu') && !target.closest('#start-btn') && !target.closest('#context-menu')) closeStartMenu();
    });

    // Аватар в шапке: клик — выбор рисунка, правый клик — меню «Изменить рисунок...»
    const avatar = document.querySelector<HTMLElement>('.sm-avatar');
    if (avatar) {
        avatar.style.cursor = 'pointer';
        avatar.addEventListener('click', e => {
            e.stopPropagation();
            closeStartMenu();
            openAvatarPicker();
        });
        avatar.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, [
                { icon: xpIconHtml('user', 16), label: 'Изменить рисунок...', action: () => { closeStartMenu(); openAvatarPicker(); } },
            ]);
        });
    }

    updateStartMenuUser();
    on('user-changed', updateStartMenuUser);
    initMru();

    // Каскад «Все программы» доступен и как действие
    registerAction('open-all-programs', openCascadeNow);
    // Системные утилиты
    registerAction(ACTION.openSearch, openSearch);
    registerAction(ACTION.openRun, openRun);
    registerAction(ACTION.openTaskmgr, openTaskManager);
}
