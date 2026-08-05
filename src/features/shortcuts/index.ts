// Диалоги добавления/редактирования ярлыков и папок, захват скриншотов,
// вставка из буфера, обработка внешних дропов (закладки/ссылки).
// Порт ADD / EDIT DIALOG (script.js:2965-3200).

import { el, xpIconHtml } from '../../core/dom';
import { debounce } from '../../core/debounce';
import { links, saveLinks } from '../../core/state';
import { registerAction, ACTION } from '../../core/actions';
import { showNotification } from '../../core/notifications';
import { saveScreenshot } from '../../core/screenshots';
import { wmClose, wmCreate, wmGet } from '../../wm/windowManager';
import { renderDesktop, refreshFolderWindow, saveAndRender, setDropHandlers } from '../desktop';
import type { LinkItem } from '../../core/types';

interface EditCtx {
    tileIndex: number | null;
    childIndex: number | null;
    folderIndex: number | null;
}

let editCtx: EditCtx = { tileIndex: null, childIndex: null, folderIndex: null };

export function openAddDialog(folderIndex: number | null): void {
    editCtx = { tileIndex: null, childIndex: null, folderIndex: folderIndex };
    showTileDialog(false, null);
}

export function openAddFolderDialog(): void {
    editCtx = { tileIndex: null, childIndex: null, folderIndex: null };
    showTileDialog(true, null);
}

export function openEditDialog(ti: number, ci: number | null): void {
    editCtx = { tileIndex: ti, childIndex: ci, folderIndex: null };
    const item = (ci !== null) ? links[ti].items![ci] : links[ti];
    showTileDialog(!!item.isFolder, item);
}

// ==================== ВНЕШНИЕ ДРОПЫ / БУФЕР ====================

export function handleLinkDrop(e: DragEvent, folderIndex: number | null): void {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt) return;
    const types = Array.from(dt.types || []);
    if (!types.includes('text/uri-list') && !types.includes('text/plain')) return;

    // Извлечь URL — сначала uri-list, затем plain
    let url = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim().split('\n')[0].trim();
    if (!url || /^#/.test(url)) return;
    if (!/^https?:\/\//i.test(url)) {
        if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
        else return;
    }

    // Имя — из заголовка <a> в text/html
    let name = '';
    const html = dt.getData('text/html') || '';
    const m = html.match(/<a[^>]*>([^<]+)<\/a>/i);
    if (m) name = m[1].trim();
    if (!name) {
        try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; }
    }

    const item: LinkItem = { name: name, url: url };
    if (folderIndex !== null && folderIndex !== undefined && links[folderIndex] && links[folderIndex].isFolder) {
        links[folderIndex].items!.push(item);
        saveLinks();
        refreshFolderWindow(folderIndex);
    } else {
        links.push(item);
        saveLinks();
        renderDesktop();
    }
}

export async function handleFolderDrop(e: DragEvent, destFolderIndex: number | null): Promise<void> {
    e.preventDefault();
    const folderName = (e.dataTransfer?.getData('text/plain') || '').trim();
    if (!folderName || typeof chrome === 'undefined' || !chrome.bookmarks) return;
    let results: chrome.bookmarks.BookmarkTreeNode[];
    try { results = await chrome.bookmarks.search({ title: folderName }); } catch { return; }
    const bmFolder = results.find(b => !b.url);
    if (!bmFolder) return;
    let children: chrome.bookmarks.BookmarkTreeNode[];
    try { children = await chrome.bookmarks.getChildren(bmFolder.id); } catch { return; }
    const items: LinkItem[] = children.filter(c => !!c.url).map(c => ({ name: c.title, url: c.url }));
    if (!items.length) return;
    if (destFolderIndex !== null && destFolderIndex !== undefined && links[destFolderIndex] && links[destFolderIndex].isFolder) {
        items.forEach(it => { links[destFolderIndex].items!.push(it); });
        saveLinks();
        refreshFolderWindow(destFolderIndex);
    } else {
        links.push({ isFolder: true, name: bmFolder.title, items: items });
        saveLinks();
        renderDesktop();
    }
}

export async function pasteUrl(folderIndex: number | null): Promise<void> {
    let text: string;
    try { text = await navigator.clipboard.readText(); } catch { return; }
    text = (text || '').trim();
    if (!text) return;
    let url = text;
    if (!/^https?:\/\//i.test(url)) {
        if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
        else return;
    }
    let name: string;
    try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; }
    const item: LinkItem = { name: name, url: url };
    if (folderIndex !== null && folderIndex !== undefined && links[folderIndex] && links[folderIndex].isFolder) {
        links[folderIndex].items!.push(item);
        saveLinks();
        refreshFolderWindow(folderIndex);
    } else {
        links.push(item);
        saveLinks();
        renderDesktop();
    }
}

// ==================== СКРИНШОТЫ ====================

export function requestScreenshot(url: string, targetItem: LinkItem): void {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    chrome.runtime.sendMessage({ action: 'capture_screenshot', url: url }, response => {
        // ФИКС АУДИТА: проверка lastError (в оригинале неудача молча игнорировалась)
        if (chrome.runtime.lastError) {
            console.warn('[XP] захват скриншота не удался:', chrome.runtime.lastError.message);
            return;
        }
        if (response && response.success) {
            targetItem.screenshot = response.dataUrl;
            saveScreenshot(url, response.dataUrl);
            saveAndRender();
        }
    });
}

// ==================== ДИАЛОГ ЯРЛЫКА/ПАПКИ ====================

function showTileDialog(isFolder: boolean, item: LinkItem | null): void {
    const winId = 'tile-dialog';
    const isEdit = item !== null;
    wmClose(winId);
    const c = el('div', { className: 'dialog-form' });
    const ng = el('div', { className: 'form-group', html: '<label>Название:</label>' });
    const ni = el('input', { type: 'text', value: item ? item.name : '' }) as HTMLInputElement;
    ni.placeholder = isFolder ? 'Название' : 'Оставьте пустым — возьмём с сайта';
    ng.appendChild(ni);
    c.appendChild(ng);

    let ui: HTMLInputElement | null = null;
    let ii: HTMLInputElement | null = null;
    let acEl: HTMLElement | null = null;
    let appc: HTMLInputElement | null = null;
    // Единственное определение acHide — работает даже если acEl=null
    let acItems: chrome.history.HistoryItem[] = [];
    let acFocused = -1;
    function acHide(): void { if (acEl) { acEl.style.display = 'none'; } acItems = []; acFocused = -1; }

    if (!isFolder) {
        const ug = el('div', { className: 'form-group', html: '<label>Ссылка:</label>' });
        ui = el('input', { type: 'text', value: (item && item.url) ? item.url : '' }) as HTMLInputElement;
        ui.placeholder = 'https://...';
        ug.appendChild(ui);
        c.appendChild(ug);

        // --- Автодополнение URL ---
        acEl = el('div', { className: 'xp-url-autocomplete', style: 'display:none' });
        document.body.appendChild(acEl);

        const urlInput = ui;
        const acBox = acEl;
        function acPosition(): void {
            const r = urlInput.getBoundingClientRect();
            acBox.style.left = r.left + 'px';
            acBox.style.top = r.bottom + 'px';
            acBox.style.width = r.width + 'px';
        }
        function acRender(results: chrome.history.HistoryItem[]): void {
            acBox.innerHTML = '';
            acItems = results;
            acFocused = -1;
            results.forEach(h => {
                const row = el('div', { className: 'xp-url-ac-item' });
                const img = el('img', {
                    src: 'chrome-extension://' + chrome.runtime.id + '/_favicon/?pageUrl=' + encodeURIComponent(h.url || '') + '&size=16',
                    alt: '',
                });
                img.onerror = () => { img.style.visibility = 'hidden'; };
                row.appendChild(img);
                row.appendChild(el('span', { text: h.title ? h.title + ' — ' + h.url : (h.url || '') }));
                row.addEventListener('mousedown', e => {
                    e.preventDefault();
                    urlInput.value = h.url || '';
                    acHide();
                    urlInput.focus();
                });
                acBox.appendChild(row);
            });
            if (results.length > 0) { acPosition(); acBox.style.display = 'block'; }
            else acHide();
        }
        function acSetFocus(idx: number): void {
            const rows = acBox.querySelectorAll('.xp-url-ac-item');
            rows.forEach(r => r.classList.remove('ac-focused'));
            acFocused = Math.max(0, Math.min(idx, acItems.length - 1));
            if (rows[acFocused]) rows[acFocused].classList.add('ac-focused');
        }
        // ФИКС АУДИТА: debounce поиска по истории (в оригинале — на каждый input)
        urlInput.addEventListener('input', debounce(() => {
            const q = urlInput.value.trim();
            if (!q) { acHide(); return; }
            if (typeof chrome === 'undefined' || !chrome.history) return;
            chrome.history.search({ text: q, maxResults: 8, startTime: 0 }, r => { acRender(r || []); });
        }, 180));
        urlInput.addEventListener('keydown', e => {
            if (acBox.style.display === 'none') return;
            if (e.key === 'ArrowDown') { e.preventDefault(); acSetFocus(acFocused < 0 ? 0 : acFocused + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); acSetFocus(acFocused <= 0 ? 0 : acFocused - 1); }
            else if (e.key === 'Enter' && acFocused >= 0) { e.stopPropagation(); urlInput.value = acItems[acFocused].url || ''; acHide(); }
            else if (e.key === 'Escape') { acHide(); }
        });
        urlInput.addEventListener('blur', () => { setTimeout(acHide, 150); });
        urlInput.addEventListener('focus', () => { if (urlInput.value.trim()) urlInput.dispatchEvent(new Event('input')); });

        const ig = el('div', { className: 'form-group', html: '<label>Иконка (URL, необязательно):</label>' });
        ii = el('input', { type: 'text', value: (item && item.customIcon) ? item.customIcon : '' }) as HTMLInputElement;
        ii.placeholder = 'URL иконки';
        ig.appendChild(ii);
        c.appendChild(ig);

        // Веб-приложение: открывать в XP-окне, а не в новой вкладке
        const ag = el('div', { className: 'form-group' });
        const aLbl = el('label', { style: 'cursor:pointer' });
        appc = el('input', { type: 'checkbox' }) as HTMLInputElement;
        appc.checked = !!(item && item.app);
        aLbl.appendChild(appc);
        aLbl.append(' Открывать в окне (веб-приложение)');
        ag.appendChild(aLbl);
        c.appendChild(ag);
    }

    const bd = el('div', { className: 'dialog-btns' });
    const sv = el('button', { className: 'xp-dialog-btn xp-dialog-btn-primary', text: 'OK' }) as HTMLButtonElement;
    const cn = el('button', { className: 'xp-dialog-btn', text: 'Отмена' });
    bd.appendChild(sv);
    bd.appendChild(cn);
    c.appendChild(bd);
    wmCreate(winId, isEdit ? 'Изменить' : (isFolder ? 'Создать папку' : 'Создать ярлык'), c, 320, isFolder ? 150 : 275, isFolder ? xpIconHtml('folder', 16) : xpIconHtml('internet-shortcut', 16));
    const dlgWin = wmGet(winId);
    if (dlgWin) dlgWin.onClose = () => { if (acEl && acEl.parentNode) acEl.remove(); acEl = null; };
    setTimeout(() => { ni.focus(); }, 50);

    function doSave(resolvedName: string): void {
        if (isFolder) {
            if (isEdit) {
                links[editCtx.tileIndex!].name = resolvedName;
                const fw = wmGet('folder-' + editCtx.tileIndex);
                if (fw) fw.el.querySelector('.xp-titlebar-title')!.textContent = resolvedName;
            } else {
                links.push({ isFolder: true, name: resolvedName, items: [] });
            }
        } else {
            let url = ui ? ui.value.trim() : '';
            if (!url) return;
            if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(url)) url = 'https://' + url;
            const ci_ = ii ? ii.value.trim() : '';
            const newItem: LinkItem = { name: resolvedName, url: url };
            if (ci_) newItem.customIcon = ci_;
            if (appc && appc.checked) newItem.app = true;
            if (isEdit) {
                if (editCtx.childIndex !== null) {
                    links[editCtx.tileIndex!].items![editCtx.childIndex] = newItem;
                    refreshFolderWindow(editCtx.tileIndex!);
                } else {
                    links[editCtx.tileIndex!] = newItem;
                }
            } else if (editCtx.folderIndex !== null) {
                links[editCtx.folderIndex].items!.push(newItem);
                refreshFolderWindow(editCtx.folderIndex);
            } else {
                links.push(newItem);
            }
            const targetIdx = (editCtx.folderIndex !== null) ? editCtx.folderIndex : (isEdit ? editCtx.tileIndex! : links.length - 1);
            const childIdxToUpdate = (editCtx.folderIndex !== null) ? (links[editCtx.folderIndex].items!.length - 1) : editCtx.childIndex;
            const finalItem = (childIdxToUpdate !== null) ? links[targetIdx].items![childIdxToUpdate] : links[targetIdx];
            if (finalItem && finalItem.url) requestScreenshot(finalItem.url, finalItem);
            if (!isEdit) showNotification('Ярлык создан', finalItem ? finalItem.name : '', '🔗');
        }
        saveAndRender();
        wmClose(winId);
    }

    sv.addEventListener('click', () => {
        acHide();
        const name = ni.value.trim();
        if (isFolder) { if (!name) return; doSave(name); return; }
        const url = ui ? ui.value.trim() : '';
        if (!url) return;
        if (name) { doSave(name); return; }
        // Имя пустое — тянем заголовок с сайта
        const fullUrl = /^[a-z][a-z0-9+\-.]*:\/\//i.test(url) ? url : 'https://' + url;
        sv.disabled = true;
        sv.textContent = '…';
        chrome.runtime.sendMessage({ action: 'fetch_page_title', url: fullUrl }, resp => {
            const title = (resp && resp.success && resp.title) ? resp.title : (() => { try { return new URL(fullUrl).hostname; } catch { return fullUrl; } })();
            doSave(title);
        });
    });

    cn.addEventListener('click', () => { acHide(); wmClose(winId); });
    if (dlgWin) dlgWin.el.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !(acEl && acEl.style.display !== 'none' && acFocused >= 0)) sv.click();
        if (e.key === 'Escape') { acHide(); wmClose(winId); }
    });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

export function initShortcuts(): void {
    registerAction(ACTION.addShortcut, (p) => openAddDialog((p as { folderIndex: number | null } | undefined)?.folderIndex ?? null));
    registerAction(ACTION.addFolder, () => openAddFolderDialog());
    registerAction(ACTION.editShortcut, (p) => {
        const { index, childIndex } = (p || {}) as { index: number; childIndex: number | null };
        openEditDialog(index, childIndex);
    });
    registerAction(ACTION.pasteShortcut, (p) => {
        void pasteUrl((p as { folderIndex: number | null } | undefined)?.folderIndex ?? null);
    });
    registerAction(ACTION.refreshScreenshot, (p) => {
        const { url, item } = (p || {}) as { url: string; item: LinkItem };
        if (url) requestScreenshot(url, item);
    });
    // Обработчики внешних дропов (закладки/ссылки на рабочий стол и в папки)
    setDropHandlers({ onLinkDrop: handleLinkDrop, onFolderDrop: handleFolderDrop });
}
