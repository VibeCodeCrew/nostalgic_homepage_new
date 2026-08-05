// Диск D: — закладки браузера через chrome.bookmarks (дерево в стиле XP Проводника).
// Порт BROWSER BOOKMARKS (script.js:3871-4022).

import { el, escapeHtml, xpIconHtml, getFaviconUrl } from '../../core/dom';
import { settings } from '../../core/state';
import { wmCreate, wmGet, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { macIcon16 } from '../themes';
import { navToUrl } from '../desktop';

type BmNode = chrome.bookmarks.BookmarkTreeNode;

const FOLDER_SVG_XP =
    '<svg width="16" height="14" viewBox="0 0 48 40" style="flex-shrink:0;margin-right:5px">' +
    '<path d="M2 8 L2 37 L46 37 L46 13 L22 13 L18 8 Z" fill="#f0c040" stroke="#c89828" stroke-width="1.5"/>' +
    '<path d="M2 16 L46 16 L46 37 L2 37 Z" fill="#f8d860" stroke="#c89828" stroke-width="0.5"/>' +
    '</svg>';

function folderIconHtml(): string {
    return settings.theme === 'macos'
        ? '<img src="icons/mac/folder.png" width="16" height="14" style="flex-shrink:0;margin-right:5px;object-fit:contain" alt="">'
        : FOLDER_SVG_XP;
}

export function openBrowserBookmarks(): void {
    if (wmWindows['bkmarks']) { wmRestore('bkmarks'); wmFocus('bkmarks'); return; }

    const wrap = el('div', { className: 'xp-explorer' });

    // Тулбар / адресная строка
    const tb = el('div', { className: 'xp-explorer-toolbar' });
    const addr = el('div', { className: 'xp-explorer-addr' });
    addr.innerHTML = '<span class="xp-explorer-addr-icon">📚</span><span id="bkmarks-addr-txt">D:\\Избранное</span>';
    tb.appendChild(addr);
    wrap.appendChild(tb);
    wrap.appendChild(el('div', { className: 'xp-explorer-toolbar-sep' }));

    // Тело
    const body = el('div', { className: 'xp-explorer-body' });

    // Сайдбар — дерево папок
    const sidebar = el('div', { className: 'xp-explorer-sidebar' });
    const sbTitle = el('div', { className: 'xp-explorer-sb-title' });
    sbTitle.innerHTML = (settings.theme === 'macos' ? macIcon16('folder') : xpIconHtml('folder', 16)) + ' Папки';
    sidebar.appendChild(sbTitle);
    const treeEl = el('div', { id: 'bkmarks-tree' });
    sidebar.appendChild(treeEl);

    // Список элементов
    const main = el('div', { className: 'xp-explorer-main' });
    const rowsEl = el('div', { className: 'xp-explorer-rows', id: 'bkmarks-rows' });
    main.appendChild(rowsEl);
    const statusEl = el('div', { className: 'xp-explorer-status', id: 'bkmarks-status' });
    statusEl.textContent = 'Загрузка...';
    main.appendChild(statusEl);

    body.appendChild(sidebar);
    body.appendChild(main);
    wrap.appendChild(body);

    wmCreate('bkmarks', 'Избранное (D:)', wrap, 580, 420, xpIconHtml('favorites', 16));

    if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        statusEl.textContent = 'Закладки недоступны';
        return;
    }
    chrome.bookmarks.getTree(tree => {
        if (!wmGet('bkmarks')) return;
        const roots = (tree[0] && tree[0].children) ? tree[0].children : [];
        renderTree(roots);
        if (roots.length > 0) showFolder(roots[0]);
    });

    function renderTree(nodes: BmNode[]): void {
        treeEl.innerHTML = '';
        nodes.forEach(node => {
            if (node.url) return;
            treeEl.appendChild(makeFolderRow(node, 0));
        });
    }

    function makeFolderRow(node: BmNode, depth: number): HTMLElement {
        const wrap = el('div', {});
        const row = el('div', { className: 'bkmarks-tree-item', style: 'padding-left:' + (8 + depth * 14) + 'px' });
        row.innerHTML = folderIconHtml() + '<span>' + escapeHtml(node.title || '(без имени)') + '</span>';
        row.addEventListener('click', e => {
            e.stopPropagation();
            treeEl.querySelectorAll('.bkmarks-tree-item').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            showFolder(node);
            const addrTxt = document.getElementById('bkmarks-addr-txt');
            if (addrTxt) addrTxt.textContent = 'D:\\' + (node.title || '');
        });
        wrap.appendChild(row);
        if (node.children) {
            node.children.forEach(child => {
                if (!child.url) wrap.appendChild(makeFolderRow(child, depth + 1));
            });
        }
        return wrap;
    }

    function showFolder(node: BmNode): void {
        rowsEl.innerHTML = '';
        const children = node.children || [];
        const folders = children.filter(c => !c.url);
        const items = children.filter(c => !!c.url);
        let idx = 0;

        folders.forEach(folder => {
            const row = el('div', { className: 'xp-explorer-row' + (idx++ % 2 === 1 ? ' even' : '') });
            row.innerHTML =
                folderIconHtml() +
                '<span class="xp-explorer-row-name">' + escapeHtml(folder.title || '(без имени)') + '</span>' +
                '<span class="xp-explorer-row-url" style="color:#888">Папка</span>';
            row.addEventListener('dblclick', () => {
                showFolder(folder);
                const addrTxt = document.getElementById('bkmarks-addr-txt');
                if (addrTxt) addrTxt.textContent = 'D:\\' + (folder.title || '');
                treeEl.querySelectorAll('.bkmarks-tree-item').forEach(r => r.classList.remove('selected'));
            });
            rowsEl.appendChild(row);
        });

        items.forEach(item => {
            const row = el('div', { className: 'xp-explorer-row' + (idx++ % 2 === 1 ? ' even' : '') });
            row.innerHTML =
                '<span class="xp-explorer-row-name">' + escapeHtml(item.title || item.url || '') + '</span>' +
                '<span class="xp-explorer-row-url">' + escapeHtml(item.url || '') + '</span>';
            const bmImg = el('img', { className: 'xp-explorer-row-ico', alt: '' });
            bmImg.src = getFaviconUrl(item.url || '');
            bmImg.onerror = () => {
                const fb = el('span', { className: 'xp-explorer-row-ico-fallback' });
                fb.innerHTML = xpIconHtml('internet', 16);
                bmImg.replaceWith(fb);
            };
            row.insertBefore(bmImg, row.firstChild);
            row.addEventListener('click', () => {
                rowsEl.querySelectorAll('.xp-explorer-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
            });
            row.addEventListener('dblclick', () => { navToUrl(item.url || ''); });
            rowsEl.appendChild(row);
        });

        statusEl.textContent = 'Объектов: ' + (folders.length + items.length);
    }
}
