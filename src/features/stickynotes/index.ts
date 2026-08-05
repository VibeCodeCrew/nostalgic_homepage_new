// Стикеры (Post-it) на рабочем столе — порт STICKY NOTES (script.js:4024-4123).
// Персистятся в edge_stickies; drag/resize, палитра цветов, закрытие.

import './stickynotes.css';
import { KEY_STICKIES } from '../../core/keys';
import { safeParse, getStrOrNull, setJSON } from '../../core/store';
import { debounce } from '../../core/debounce';
import { registerAction, ACTION } from '../../core/actions';
import type { StickyNote } from '../../core/types';

interface StickyColor { bg: string; bar: string; label: string }

const STICKY_COLORS: StickyColor[] = [
    { bg: '#fff9a0', bar: '#d4b800', label: 'Жёлтый' },
    { bg: '#b8f0b8', bar: '#3a9a3a', label: 'Зелёный' },
    { bg: '#b8d8ff', bar: '#2060c0', label: 'Синий' },
    { bg: '#ffb8d0', bar: '#c03060', label: 'Розовый' },
];

// ФИКС АУДИТА: safeParse — битый JSON не роняет старт (в оригинале голый JSON.parse)
let stickies: StickyNote[] = safeParse<StickyNote[]>(getStrOrNull(KEY_STICKIES), []);

function saveStickies(): void {
    setJSON(KEY_STICKIES, stickies);
}

// ФИКС АУДИТА: запись при вводе текста по debounce (в оригинале — полный stringify на каждое нажатие)
const saveStickiesDebounced = debounce(saveStickies, 300);

function findSticky(id: string): StickyNote | undefined {
    return stickies.find(s => s.id === id);
}

function createSticky(opts?: Partial<StickyNote>): HTMLElement {
    const id = opts && opts.id ? opts.id : 'sticky_' + Date.now();
    const x = opts && opts.x != null ? opts.x : Math.floor(Math.random() * 300 + 100);
    const y = opts && opts.y != null ? opts.y : Math.floor(Math.random() * 200 + 60);
    const w = opts && opts.w ? opts.w : 180;
    const h = opts && opts.h ? opts.h : 140;
    const text = opts && opts.text ? opts.text : '';
    const colorIdx = opts && opts.colorIdx != null ? opts.colorIdx : 0;
    const color = STICKY_COLORS[colorIdx] || STICKY_COLORS[0];

    const node = document.createElement('div');
    node.className = 'xp-sticky'; node.dataset.stickyId = id;
    node.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;background:' + color.bg + ';';

    const bar = document.createElement('div'); bar.className = 'xp-sticky-titlebar';
    bar.style.background = 'linear-gradient(180deg,' + color.bar + ' 0%,' + color.bar + 'cc 100%)';
    bar.style.color = '#fff';

    const colorBtns = document.createElement('div'); colorBtns.className = 'xp-sticky-colors';
    STICKY_COLORS.forEach((c, i) => {
        const cb = document.createElement('div'); cb.className = 'xp-sticky-color-btn';
        cb.style.background = c.bg; cb.title = c.label;
        cb.addEventListener('click', () => {
            const s = findSticky(id);
            if (s) { s.colorIdx = i; saveStickies(); }
            // reapply colors
            node.style.background = STICKY_COLORS[i].bg;
            bar.style.background = 'linear-gradient(180deg,' + STICKY_COLORS[i].bar + ' 0%,' + STICKY_COLORS[i].bar + 'cc 100%)';
            body.style.background = 'transparent';
        });
        colorBtns.appendChild(cb);
    });
    const closeBtn = document.createElement('span'); closeBtn.className = 'xp-sticky-close'; closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
        stickies = stickies.filter(s => s.id !== id);
        saveStickies(); node.remove();
    });
    bar.appendChild(colorBtns); bar.appendChild(closeBtn);

    const body = document.createElement('textarea'); body.className = 'xp-sticky-body';
    body.value = text; body.placeholder = 'Заметка...';
    body.style.background = 'transparent';
    body.addEventListener('input', () => {
        const s = findSticky(id); if (s) { s.text = body.value; saveStickiesDebounced(); }
    });

    const rh = document.createElement('div'); rh.className = 'xp-sticky-resize';

    node.appendChild(bar); node.appendChild(body); node.appendChild(rh);
    document.getElementById('desktop')!.appendChild(node);

    // Drag
    bar.addEventListener('mousedown', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target === closeBtn || target.classList.contains('xp-sticky-color-btn')) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, ox = node.offsetLeft, oy = node.offsetTop;
        node.style.zIndex = '8600';
        function onM(ev: MouseEvent): void {
            node.style.left = (ox + ev.clientX - sx) + 'px';
            node.style.top = Math.max(0, oy + ev.clientY - sy) + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            node.style.zIndex = '8500';
            const s = findSticky(id);
            if (s) { s.x = node.offsetLeft; s.y = node.offsetTop; saveStickies(); }
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });
    // Resize
    rh.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, sw = node.offsetWidth, sh = node.offsetHeight;
        function onM(ev: MouseEvent): void {
            node.style.width = Math.max(120, sw + ev.clientX - sx) + 'px';
            node.style.height = Math.max(80, sh + ev.clientY - sy) + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            const s = findSticky(id);
            if (s) { s.w = node.offsetWidth; s.h = node.offsetHeight; saveStickies(); }
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });

    if (!opts || !opts.id) {
        stickies.push({ id: id, text: text, x: x, y: y, w: w, h: h, colorIdx: colorIdx });
        saveStickies();
    }
    return node;
}

function renderStickies(): void {
    stickies.forEach(s => { createSticky(s); });
}

export function initStickyNotes(): void {
    renderStickies();
    registerAction(ACTION.newSticky, () => createSticky());
}
