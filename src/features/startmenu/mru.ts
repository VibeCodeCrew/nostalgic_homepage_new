// Настоящий MRU (Most Recently Used) левой колонки меню «Пуск».
// Заполнение: запуски приложений (событие wm-opened) и ярлыков (link-opened).
// Хранение: edge_mru (JSON-массив, max 7), переживает перезагрузку.

import { KEY_MRU } from '../../core/keys';
import { safeParse, setJSON } from '../../core/store';
import { el, getFaviconUrl } from '../../core/dom';
import { on } from '../../core/events';
import { runAction } from '../../core/actions';
import { openLinkItem } from '../desktop';

interface MruEntry {
    kind: 'app' | 'link';
    id?: string;     // kind=app: id окна/приложения (app:notepad и т.п.)
    url?: string;    // kind=link
    title: string;
    icon?: string;   // kind=app: имя png из icons/; kind=link: favicon/customIcon URL
}

const MRU_MAX = 7;

// Иконки приложений для MRU (id окна → имя png в icons/32)
const APP_ICONS: Record<string, string> = {
    notepad: 'notepad', wordpad: 'wordpad', paint: 'paint', calculator: 'calculator',
    cmd: 'cmd', minesweeper: 'minesweeper', solitaire: 'solitaire', hearts: 'hearts',
    pinball: 'pinball', doom: 'doom', search: 'search', taskmgr: 'taskmgr',
};

let mru: MruEntry[] = safeParse<MruEntry[]>(localStorage.getItem(KEY_MRU), []);

function saveMru(): void {
    setJSON(KEY_MRU, mru);
}

function pushEntry(entry: MruEntry): void {
    mru = mru.filter(e =>
        entry.kind === 'app' ? !(e.kind === 'app' && e.id === entry.id)
                             : !(e.kind === 'link' && e.url === entry.url));
    mru.unshift(entry);
    if (mru.length > MRU_MAX) mru.length = MRU_MAX;
    saveMru();
}

/** Подписки на запуски. Вызывается из initStartMenu. */
export function initMru(): void {
    on('wm-opened', ({ id, title }) => {
        if (!APP_ICONS[id]) return; // в MRU только «программы», не служебные окна
        pushEntry({ kind: 'app', id: id, title: title, icon: APP_ICONS[id] });
    });
    on('link-opened', ({ url, name }) => {
        if (!url) return;
        pushEntry({ kind: 'link', url: url, title: name });
    });
}

/** Перерисовать список MRU в меню (вызывается при каждом открытии меню). */
export function renderMru(): void {
    const host = document.querySelector('.sm-mru');
    if (!host) return;
    host.innerHTML = '';
    mru.forEach(entry => {
        const row = el('div', { className: 'sm-mru-item' });
        const iconWrap = el('span', { className: 'sm-mru-icon' });
        if (entry.kind === 'app') {
            iconWrap.innerHTML = '<img class="xp-icon-img" src="icons/32/' + entry.icon + '.png" width="32" height="32" alt="">';
        } else {
            const img = el('img', { src: entry.icon || getFaviconUrl(entry.url || ''), alt: '', className: 'sm-mru-favicon' });
            img.onerror = () => { img.style.visibility = 'hidden'; };
            iconWrap.appendChild(img);
        }
        row.appendChild(iconWrap);
        row.appendChild(el('span', { className: 'sm-mru-name', text: entry.title }));
        row.addEventListener('click', e => {
            e.stopPropagation();
            if (entry.kind === 'app') runAction('app:' + entry.id);
            else openLinkItem({ name: entry.title, url: entry.url });
        });
        host.appendChild(row);
    });
}
