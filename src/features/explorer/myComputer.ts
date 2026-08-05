// «Мой компьютер» — диски C:/D:, документы, корзина, сведения.
// Порт MY COMPUTER (script.js:3816-3869).

import { el, escapeHtml, xpIconHtml } from '../../core/dom';
import { links, settings, trashedLinks } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { wmCreate, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { macIcon, macIcon16 } from '../themes';

export function openMyComputer(): void {
    if (wmWindows['mycomputer']) { wmRestore('mycomputer'); wmFocus('mycomputer'); return; }
    const mac = settings.theme === 'macos';
    const wrap = el('div', { className: 'mycomputer-wrap' });

    const sidebar = el('div', { className: 'mycomputer-sidebar' });
    sidebar.innerHTML = '<h4>Системные задачи</h4>';
    const sbItems: Array<[string, () => void]> = mac ? [
        [macIcon16('notepad') + ' Блокнот', () => { runAction('app:notepad'); }],
        [macIcon16('search') + ' Поиск', () => { runAction(ACTION.openSearch); }],
        [macIcon16('recycle') + ' Корзина', () => { runAction(ACTION.openRecycle); }],
        [macIcon16('settings') + ' Сведения', () => { runAction(ACTION.openSysInfo); }],
    ] : [
        [xpIconHtml('notepad', 16) + ' Блокнот', () => { runAction('app:notepad'); }],
        [xpIconHtml('search', 16) + ' Поиск', () => { runAction(ACTION.openSearch); }],
        [xpIconHtml('recycle-bin', 16) + ' Корзина', () => { runAction(ACTION.openRecycle); }],
        [xpIconHtml('my-computer', 16) + ' Сведения', () => { runAction(ACTION.openSysInfo); }],
    ];
    sbItems.forEach(item => {
        const d = el('div', { className: 'mycomputer-sidebar-item' });
        d.innerHTML = item[0];
        d.addEventListener('click', item[1]);
        sidebar.appendChild(d);
    });

    const main = el('div', { className: 'mycomputer-main' });
    const addr = el('div', { className: 'mycomputer-address' });
    addr.innerHTML = mac
        ? '<span>' + macIcon16('harddisk') + '</span><span>Macintosh HD</span>'
        : '<span>' + xpIconHtml('my-computer', 16) + '</span><span>Мой компьютер</span>';
    main.appendChild(addr);

    const drives = el('div', { className: 'mycomputer-drives' });
    const driveItems = mac ? [
        { icon: macIcon('harddisk', 32), name: 'Macintosh HD', info: links.length + ' объектов', action: () => { runAction(ACTION.openLinksExplorer); } },
        { icon: macIcon('folder', 32), name: 'Закладки браузера', info: 'Избранное', action: () => { runAction('open-bookmarks'); } },
        { icon: macIcon('wordpad', 32), name: 'Документы', info: 'WordPad', action: () => { runAction('app:wordpad'); } },
        { icon: macIcon('recycle', 32), name: 'Корзина', info: trashedLinks.length + ' элементов', action: () => { runAction(ACTION.openRecycle); } },
        { icon: macIcon('settings', 32), name: 'Сведения', info: 'О системе', action: () => { runAction(ACTION.openSysInfo); } },
    ] : [
        { icon: xpIconHtml('folder', 32), name: 'Мои ярлыки (C:)', info: links.length + ' объектов', action: () => { runAction(ACTION.openLinksExplorer); } },
        { icon: xpIconHtml('favorites', 32), name: 'Избранное (D:)', info: 'Закладки браузера', action: () => { runAction('open-bookmarks'); } },
        { icon: xpIconHtml('wordpad', 32), name: 'Документы', info: 'WordPad', action: () => { runAction('app:wordpad'); } },
        { icon: xpIconHtml('recycle-bin', 32), name: 'Корзина', info: trashedLinks.length + ' элементов', action: () => { runAction(ACTION.openRecycle); } },
        { icon: xpIconHtml('my-computer', 32), name: 'Сведения', info: 'О системе', action: () => { runAction(ACTION.openSysInfo); } },
    ];
    driveItems.forEach(d => {
        const node = el('div', { className: 'mycomputer-drive' });
        node.innerHTML = '<div class="mycomputer-drive-icon">' + d.icon + '</div><div class="mycomputer-drive-name">' + escapeHtml(d.name) + '</div><div class="mycomputer-drive-info">' + escapeHtml(d.info) + '</div>';
        node.addEventListener('dblclick', d.action);
        drives.appendChild(node);
    });
    main.appendChild(drives);
    wrap.appendChild(sidebar);
    wrap.appendChild(main);
    wmCreate('mycomputer', mac ? 'Macintosh HD' : 'Мой компьютер', wrap, 540, 360, mac ? macIcon16('harddisk') : xpIconHtml('my-computer', 16));
}
