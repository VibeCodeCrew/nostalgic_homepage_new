// Режим «Плитки» (glass) — отдельный путь рендеринга.
// Порт GLASS GRID MODE (script.js:1545-1797) и GLASS OPACITY (1091-1100).

import { el, escapeHtml, getFaviconUrl } from '../../core/dom';
import { links, selectedIndices, settings } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { searchUrlFor } from './searchWidget';
import { attachSearchAutocomplete } from './autocomplete';
import { showLinkIconContextMenu, showFolderIconContextMenu, showFolderItemContextMenu } from '../contextmenu/menus';
import { setGlassItemCount } from './positioning';
import type { LinkItem } from '../../core/types';

// Зависимости от index.ts (устанавливаются init-ом, чтобы не было цикла на уровне модулей)
export interface GlassDeps {
    saveAndRender: () => void;
    navToUrl: (url: string) => void;
    handleExternalDrop: (e: DragEvent, folderIndex: number | null) => void;
}

let deps: GlassDeps;

export function initGlassDeps(d: GlassDeps): void {
    deps = d;
}

let glassDragIndex: number | null = null; // index плитки, перетаскиваемой в glass-сетке

export function applyGlassOpacity(): void {
    const st = document.documentElement.style;
    st.setProperty('--glass-opacity', String(settings.opacity));
    st.setProperty('--glass-tile-w', settings.glassTileWidth + 'px');
    st.setProperty('--glass-tile-h', settings.glassTileHeight + 'px');
    const sz = settings.iconSize;
    st.setProperty('--icon-w', sz + 'px');
    st.setProperty('--icon-h', Math.round(sz * 1.1) + 'px');
    st.setProperty('--icon-img', Math.round(sz * 0.4) + 'px');
}

function applyGlassGridVars(): void {
    const st = document.documentElement.style;
    st.setProperty('--glass-cols', String(settings.glassCols));
    st.setProperty('--glass-tile-w', settings.glassTileWidth + 'px');
    st.setProperty('--glass-tile-h', settings.glassTileHeight + 'px');
    st.setProperty('--glass-opacity', String(settings.opacity));
    st.setProperty('--glass-blur', settings.glassBlur ? '12px' : '0px');
}

export function renderGlassGrid(): void {
    applyGlassGridVars();

    // Скрыть desktop-icons (используется режимами icon/window)
    const iconsContainer = document.getElementById('desktop-icons');
    if (iconsContainer) iconsContainer.innerHTML = '';

    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    // Создать или переиспользовать wrapper
    let wrapper = document.getElementById('glass-grid-wrapper');
    if (!wrapper) {
        wrapper = el('div', { id: 'glass-grid-wrapper' });
        desktop.appendChild(wrapper);
    }
    wrapper.style.display = '';

    // Строка поиска
    let gsb = document.getElementById('glass-search-bar');
    if (!gsb) {
        gsb = el('div', { id: 'glass-search-bar' });
        gsb.innerHTML =
            '<input id="gsb-input" type="text" placeholder="Введите запрос или адрес..." autocomplete="off" spellcheck="false">' +
            '<button class="gsb-btn gsb-ya">Я</button>' +
            '<button class="gsb-btn gsb-go">G</button>';
        wrapper.appendChild(gsb);
        const inp = gsb.querySelector<HTMLInputElement>('#gsb-input')!;
        function doSearch(engine: string): void {
            const q = inp.value.trim();
            if (!q) return;
            deps.navToUrl(searchUrlFor(engine, q));
        }
        attachSearchAutocomplete(inp, {
            onPick:   q => { deps.navToUrl(searchUrlFor(settings.searchEngine, q)); },
            onSearch: q => { deps.navToUrl(searchUrlFor(settings.searchEngine, q)); },
        });
        gsb.querySelector('.gsb-ya')!.addEventListener('click', () => doSearch('ya'));
        gsb.querySelector('.gsb-go')!.addEventListener('click', () => doSearch('go'));
    }
    gsb.style.display = '';

    // Создать или переиспользовать контейнер сетки
    let grid = document.getElementById('glass-grid-container');
    if (!grid) {
        grid = el('div', { id: 'glass-grid-container', className: 'glass-grid-container' });
        wrapper.appendChild(grid);
    }
    grid.innerHTML = '';

    // Плитки
    setGlassItemCount(links.length);
    links.forEach((item, index) => {
        grid!.appendChild(item.isFolder ? createGlassGridFolder(item, index) : createGlassGridLink(item, index));
    });

    // Кнопка «Создать» в конце сетки
    const addBtn = el('div', { className: 'glass-grid-tile glass-grid-add' });
    addBtn.innerHTML = '<span class="glass-grid-add-plus">+</span><span class="glass-grid-label">Создать</span>';
    addBtn.addEventListener('click', () => { runAction(ACTION.addShortcut, { folderIndex: null }); });
    addBtn.addEventListener('dragover', e => { e.preventDefault(); addBtn.classList.add('glass-drag-over'); });
    addBtn.addEventListener('dragleave', () => { addBtn.classList.remove('glass-drag-over'); });
    addBtn.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        addBtn.classList.remove('glass-drag-over');
        if (glassDragIndex !== null) {
            e.stopPropagation();
            const moved = links.splice(glassDragIndex, 1)[0];
            links.push(moved);
            glassDragIndex = null;
            deps.saveAndRender();
        }
    });
    grid.appendChild(addBtn);
}

function createGlassGridLink(item: LinkItem, index: number): HTMLElement {
    const favicon = item.customIcon || getFaviconUrl(item.url || '');
    const node = el('a', { className: 'glass-grid-tile glass-grid-link' }) as HTMLAnchorElement;
    node.href = item.url || '#';
    node.draggable = true;
    node.title = item.name;
    node.dataset.index = String(index);
    node.innerHTML =
        '<img class="glass-grid-favicon" src="' + escapeHtml(favicon) + '" alt="' + escapeHtml(item.name) + '">' +
        '<span class="glass-grid-label">' + escapeHtml(item.name) + '</span>';

    node.addEventListener('click', (e: MouseEvent) => {
        if (node.classList.contains('glass-dragging')) { e.preventDefault(); return; }
        if (!/^https?:\/\//i.test(item.url || '')) {
            e.preventDefault();
            deps.navToUrl(item.url || '');
        }
    });

    node.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        selectedIndices.clear();
        selectedIndices.add(index);
        showLinkIconContextMenu(e.clientX, e.clientY, index);
    });

    // Drag & drop для переупорядочивания
    node.addEventListener('dragstart', () => {
        glassDragIndex = index;
        setTimeout(() => { node.classList.add('glass-dragging'); }, 0);
    });
    node.addEventListener('dragend', () => { node.classList.remove('glass-dragging'); glassDragIndex = null; });
    node.addEventListener('dragover', e => { e.preventDefault(); node.classList.add('glass-drag-over'); });
    node.addEventListener('dragleave', () => { node.classList.remove('glass-drag-over'); });
    node.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        node.classList.remove('glass-drag-over');
        if (glassDragIndex !== null) {
            e.stopPropagation();
            if (glassDragIndex === index) return;
            const moved = links.splice(glassDragIndex, 1)[0];
            links.splice(index, 0, moved);
            glassDragIndex = null;
            deps.saveAndRender();
        }
        // Внешние дропы (закладки) всплывают к обработчику #desktop
    });

    if (settings.glassScreenshotBg && item.screenshot) {
        // Полупрозрачный белый слой поверх скриншота — чтобы текст читался
        node.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.7)), url('${item.screenshot}')`;
        node.style.backgroundSize = 'cover';
        node.style.backgroundPosition = 'center';
    } else {
        node.style.backgroundImage = '';
    }

    return node;
}

function createGlassGridFolder(item: LinkItem, index: number): HTMLElement {
    const ext = item as LinkItem & { colSpan?: number; rowSpan?: number };
    const node = el('div', { className: 'glass-grid-tile glass-grid-folder' });
    node.draggable = true;
    node.dataset.index = String(index);

    if (ext.colSpan) node.style.gridColumn = 'span ' + ext.colSpan;
    if (ext.rowSpan) node.style.gridRow = 'span ' + ext.rowSpan;

    node.innerHTML = '<div class="glass-folder-title">' + escapeHtml(item.name) + '</div>';
    const listEl = el('div', { className: 'glass-folder-items' });

    (item.items || []).forEach((child, childIdx) => {
        const a = el('a', { className: 'glass-mini-link' }) as HTMLAnchorElement;
        a.href = child.url || '#';
        a.addEventListener('dragstart', e => { e.preventDefault(); e.stopPropagation(); });
        const cfav = child.customIcon || getFaviconUrl(child.url || '');
        a.innerHTML = '<img src="' + escapeHtml(cfav) + '" alt="' + escapeHtml(child.name) + '"><span>' + escapeHtml(child.name) + '</span>';
        a.addEventListener('click', (e: MouseEvent) => {
            if (node.classList.contains('glass-dragging')) e.preventDefault();
        });
        a.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            showFolderItemContextMenu(e.clientX, e.clientY, index, childIdx);
        });
        listEl.appendChild(a);
    });
    node.appendChild(listEl);

    // Ресайз папки (span по сетке)
    const rh = el('div', { className: 'glass-resize-handle' });
    rh.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        node.draggable = false;
        const startX = e.clientX, startY = e.clientY;
        const startCS = ext.colSpan || 1, startRS = ext.rowSpan || 1;
        const tw = settings.glassTileWidth, th = settings.glassTileHeight, gap = 12;
        let newCS = startCS, newRS = startRS;
        function onM(ev: MouseEvent): void {
            newCS = Math.max(1, startCS + Math.round((ev.clientX - startX) / (tw + gap)));
            newRS = Math.max(1, startRS + Math.round((ev.clientY - startY) / (th + gap)));
            node.style.gridColumn = 'span ' + newCS;
            node.style.gridRow = 'span ' + newRS;
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            node.draggable = true;
            if (newCS !== startCS || newRS !== startRS) {
                ext.colSpan = newCS;
                ext.rowSpan = newRS;
                deps.saveAndRender();
            }
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });
    node.appendChild(rh);

    node.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        selectedIndices.clear();
        selectedIndices.add(index);
        showFolderIconContextMenu(e.clientX, e.clientY, index);
    });

    // Drag reorder / drop в папку
    node.addEventListener('dragstart', () => {
        glassDragIndex = index;
        setTimeout(() => { node.classList.add('glass-dragging'); }, 0);
    });
    node.addEventListener('dragend', () => { node.classList.remove('glass-dragging'); glassDragIndex = null; });
    node.addEventListener('dragover', e => {
        e.preventDefault();
        node.classList.add('glass-drag-over');
    });
    node.addEventListener('dragleave', () => { node.classList.remove('glass-drag-over'); });
    node.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        node.classList.remove('glass-drag-over');
        if (glassDragIndex !== null) {
            e.stopPropagation();
            if (glassDragIndex === index) return;
            const draggedItem = links[glassDragIndex];
            if (!draggedItem.isFolder) {
                links.splice(glassDragIndex, 1);
                item.items!.push(draggedItem);
            } else {
                const moved = links.splice(glassDragIndex, 1)[0];
                links.splice(index, 0, moved);
            }
            glassDragIndex = null;
            deps.saveAndRender();
        } else {
            // Внешний дроп (закладка из браузера) — добавить в эту папку
            e.stopPropagation();
            deps.handleExternalDrop(e, index);
        }
    });

    return node;
}
