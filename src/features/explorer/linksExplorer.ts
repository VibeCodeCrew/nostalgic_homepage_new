// «Мои ярлыки» — проводник по ярлыкам расширения (диск C:).
// Порт LINKS EXPLORER (script.js:3703-3814).

import { el, xpIconHtml } from '../../core/dom';
import { links, saveLinks, saveTrash, trashedLinks } from '../../core/state';
import { wmCreate, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { openLinkItem, saveAndRender } from '../desktop';
import type { LinkItem } from '../../core/types';

export function openLinksExplorer(): void {
    if (wmWindows['links']) { wmRestore('links'); wmFocus('links'); return; }

    const c = el('div', { className: 'xp-explorer' });
    let selectedIdx = -1;

    // --- Тулбар ---
    const tb = el('div', { className: 'xp-explorer-toolbar' });
    const backBtn = el('button', { className: 'xp-explorer-tb-btn', title: 'Назад' }) as HTMLButtonElement;
    backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L4 7l5 5" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Назад</span>';
    backBtn.disabled = true;
    const addrBar = el('div', { className: 'xp-explorer-addr' });
    addrBar.innerHTML = '<span class="xp-explorer-addr-icon">💾</span><span>Мои ярлыки (C:\\)</span>';
    tb.appendChild(backBtn);
    tb.appendChild(addrBar);
    c.appendChild(tb);

    c.appendChild(el('div', { className: 'xp-explorer-toolbar-sep' }));

    // --- Тело: сайдбар + список ---
    const body = el('div', { className: 'xp-explorer-body' });
    c.appendChild(body);

    const sidebar = el('div', { className: 'xp-explorer-sidebar' });
    const sbTitle = el('div', { className: 'xp-explorer-sb-title' });
    sbTitle.innerHTML = '<span>' + xpIconHtml('internet-shortcut', 16) + '</span> Действия';
    sidebar.appendChild(sbTitle);
    function mkSbBtn(label: string, fn: () => void): void {
        const btn = el('div', { className: 'xp-explorer-sb-item' });
        btn.innerHTML = label;
        btn.addEventListener('click', fn);
        sidebar.appendChild(btn);
    }
    mkSbBtn(xpIconHtml('internet', 16) + ' Открыть', () => {
        if (selectedIdx < 0 || !links[selectedIdx]) return;
        chrome.tabs.create({ url: links[selectedIdx].url });
    });
    mkSbBtn(xpIconHtml('rename', 16) + ' Переименовать', () => {
        if (selectedIdx < 0 || !links[selectedIdx]) return;
        const item = links[selectedIdx];
        const newName = prompt('Новое название:', item.name);
        if (newName && newName.trim()) { item.name = newName.trim(); saveLinks(); renderList(); }
    });
    mkSbBtn(xpIconHtml('delete', 16) + ' Удалить', () => {
        if (selectedIdx < 0 || !links[selectedIdx]) return;
        const item = links[selectedIdx] as LinkItem & { deletedAt?: number };
        item.deletedAt = Date.now();
        trashedLinks.push(item);
        saveTrash();
        links.splice(selectedIdx, 1);
        selectedIdx = -1;
        saveAndRender();
        renderList();
    });
    body.appendChild(sidebar);

    // Список файлов
    const main = el('div', { className: 'xp-explorer-main' });
    const hdr = el('div', { className: 'xp-explorer-hdr' });
    hdr.innerHTML = '<div class="xp-explorer-hdr-name">Имя</div><div class="xp-explorer-hdr-url">Адрес</div>';
    main.appendChild(hdr);

    const rows = el('div', { className: 'xp-explorer-rows' });

    function renderList(): void {
        rows.innerHTML = '';
        selectedIdx = -1;
        if (!links.length) {
            rows.innerHTML = '<div style="padding:16px;color:#666;font-family:Tahoma,sans-serif;font-size:11px;">Ярлыков нет. Добавьте их через рабочий стол.</div>';
            return;
        }
        links.forEach((item, i) => {
            if (item.isFolder) return; // пропускаем папки
            const row = el('div', { className: 'xp-explorer-row' + (i % 2 === 0 ? ' even' : '') });

            const ico = el('img', { className: 'xp-explorer-row-ico', alt: '' });
            ico.src = 'chrome-extension://' + chrome.runtime.id + '/_favicon/?pageUrl=' + encodeURIComponent(item.url || '') + '&size=16';
            ico.onerror = () => { ico.style.visibility = 'hidden'; };

            row.appendChild(ico);
            row.appendChild(el('div', { className: 'xp-explorer-row-name', text: item.name || item.url }));
            row.appendChild(el('div', { className: 'xp-explorer-row-url', text: item.url }));

            row.addEventListener('click', () => {
                rows.querySelectorAll('.xp-explorer-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
                selectedIdx = i;
            });
            row.addEventListener('dblclick', () => { openLinkItem(item); });
            rows.appendChild(row);
        });
    }
    renderList();
    main.appendChild(rows);
    body.appendChild(main);

    // Статус-бар
    const status = el('div', { className: 'xp-explorer-status' });
    status.textContent = 'Объектов: ' + links.filter(l => !l.isFolder).length;
    c.appendChild(status);

    wmCreate('links', 'Избранное', c, 560, 360, xpIconHtml('favorites', 16));
}
