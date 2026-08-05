// Панель «Все программы» меню «Пуск» — порт ALL PROGRAMS (script.js:3315-3424).
// Папки закрыты по умолчанию; папки рабочего стола показываются с содержимым.

import { el, escapeHtml, xpIconHtml, getFaviconUrl } from '../../core/dom';
import { links } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { navToUrl, openLinkItem } from '../desktop';
import { closeStartMenu } from './index';
import type { LinkItem } from '../../core/types';

interface ProgItem {
    name: string;
    icon?: string;      // HTML-строка иконки (доверенная)
    favicon?: string;   // URL фавиконки/кастомной иконки
    action?: () => void;
    subFolder?: boolean;
    items?: ProgItem[];
}

export function openAllPrograms(): void {
    const panel = document.getElementById('sm-all-programs');
    const list = document.getElementById('sm-programs-list');
    if (!panel || !list) return;
    list.innerHTML = '';

    // Папка: Игры (закрыта по умолчанию)
    const gameItems: ProgItem[] = [
        { icon: xpIconHtml('minesweeper', 16), name: 'Сапёр',   action: () => { closeStartMenu(); runAction('app:minesweeper'); } },
        { icon: xpIconHtml('solitaire', 16),   name: 'Косынка', action: () => { closeStartMenu(); runAction('app:solitaire'); } },
        { icon: xpIconHtml('hearts', 16),      name: 'Червы',   action: () => { closeStartMenu(); runAction('app:hearts'); } },
        { icon: xpIconHtml('pinball', 16),     name: 'Пинбол',  action: () => { closeStartMenu(); runAction(ACTION.openPinball); } },
        { icon: xpIconHtml('doom', 16),        name: 'DOOM',    action: () => { closeStartMenu(); runAction(ACTION.openDoom); } },
    ];
    list.appendChild(makeFolderBlock('Игры', gameItems, false));

    // Подпапка: Стандартные (встроенные инструменты)
    const builtins: ProgItem[] = [
        { icon: xpIconHtml('notepad', 16),    name: 'Блокнот',          action: () => { closeStartMenu(); runAction('app:notepad'); } },
        { icon: xpIconHtml('wordpad', 16),    name: 'WordPad',          action: () => { closeStartMenu(); runAction('app:wordpad'); } },
        { icon: xpIconHtml('paint', 16),      name: 'Paint',            action: () => { closeStartMenu(); runAction('app:paint'); } },
        { icon: xpIconHtml('calculator', 16), name: 'Калькулятор',      action: () => { closeStartMenu(); runAction('app:calculator'); } },
        { icon: xpIconHtml('cmd', 16),        name: 'Командная строка', action: () => { closeStartMenu(); runAction('app:cmd'); } },
        { icon: xpIconHtml('taskmgr', 16),    name: 'Диспетчер задач',  action: () => { closeStartMenu(); runAction(ACTION.openTaskmgr); } },
    ];

    // Папка: Программы — «Стандартные» + папки рабочего стола + одиночные ярлыки
    const desktopFolders: ProgItem[] = links
        .filter(i => i.isFolder && i.items && i.items.length)
        .map(folder => ({
            subFolder: true,
            name: folder.name,
            items: folder.items!.map(child => ({
                name: child.name,
                favicon: child.customIcon || getFaviconUrl(child.url || ''),
                action: () => { closeStartMenu(); navToUrl(child.url || ''); },
            })),
        }));
    const progItems: ProgItem[] = links
        .filter(i => !i.isFolder)
        .map(i => ({
            name: i.name,
            favicon: i.customIcon || getFaviconUrl(i.url || ''),
            action: () => { closeStartMenu(); navToUrl(i.url || ''); },
        }));
    const progFolderItems: ProgItem[] = [
        { subFolder: true, name: 'Стандартные', items: builtins },
        ...desktopFolders,
        ...progItems,
    ];
    list.appendChild(makeFolderBlock('Программы', progFolderItems, false));

    panel.classList.remove('hidden');
}

function makeFolderBlock(title: string, items: ProgItem[], openByDefault: boolean): HTMLElement {
    const wrap = el('div', { className: 'sm-prog-folder-wrap' });

    const hdr = el('div', {
        className: 'sm-prog-folder-header',
        html:
            '<svg width="16" height="14" viewBox="0 0 48 40" style="flex-shrink:0">' +
            '<path d="M2 8 L2 37 L46 37 L46 13 L22 13 L18 8 Z" fill="#f0c040" stroke="#c89828" stroke-width="1"/>' +
            '<path d="M2 16 L46 16 L46 37 L2 37 Z" fill="#f8d860" stroke="#c89828" stroke-width="0.5"/>' +
            '</svg><span>' + escapeHtml(title) + '</span>' +
            '<span class="sm-prog-folder-arrow">' + (openByDefault ? '▾' : '▸') + '</span>',
    });
    wrap.appendChild(hdr);

    const body = el('div', { className: 'sm-prog-folder-body' + (openByDefault ? '' : ' hidden') });

    items.forEach(item => {
        if (item.subFolder) {
            const sub = makeFolderBlock(item.name, item.items || [], false);
            sub.classList.add('sm-prog-subfolder');
            body.appendChild(sub);
            return;
        }
        const node = el('div', { className: 'sm-prog-item sm-prog-item-indent' });
        if (item.icon) {
            node.innerHTML = '<span class="sm-prog-no-icon">' + (item.icon.indexOf('<') !== -1 ? item.icon : escapeHtml(item.icon)) + '</span><span>' + escapeHtml(item.name) + '</span>';
        } else if (item.favicon) {
            const smImg = el('img', { className: 'sm-prog-favicon', src: item.favicon, alt: '' });
            smImg.onerror = () => { smImg.style.display = 'none'; };
            node.appendChild(smImg);
            node.appendChild(el('span', { text: item.name }));
        } else {
            node.innerHTML = '<span class="sm-prog-no-icon">' + xpIconHtml('document', 16) + '</span><span>' + escapeHtml(item.name) + '</span>';
        }
        if (item.action) node.addEventListener('click', item.action);
        body.appendChild(node);
    });
    wrap.appendChild(body);

    hdr.addEventListener('click', () => {
        const isOpen = !body.classList.contains('hidden');
        body.classList.toggle('hidden', isOpen);
        hdr.querySelector('.sm-prog-folder-arrow')!.textContent = isOpen ? '▸' : '▾';
    });
    return wrap;
}

/** Одиночный пункт списка программ по ярлыку (используется поиском, если понадобится). */
export function makeProgItem(item: LinkItem, inFolder: boolean): HTMLElement {
    const node = el('div', { className: 'sm-prog-item' + (inFolder ? ' sm-prog-item-indent' : '') });
    const fav = item.customIcon || getFaviconUrl(item.url || '');
    node.innerHTML = '<img class="sm-prog-favicon" src="' + escapeHtml(fav) + '" alt=""><span>' + escapeHtml(item.name) + '</span>';
    node.addEventListener('click', () => { closeStartMenu(); openLinkItem(item); });
    return node;
}
