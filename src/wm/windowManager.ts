// Оконный менеджер XP: создание/фокус/минимизация/развёртывание/закрытие окон,
// кнопки панели задач, персистенция геометрии (xp_window_geom).

import { STORAGE } from '../core/keys';
import './windowManager.css';
import { safeParse, setJSON } from '../core/store';
import { escapeHtml } from '../core/dom';
import { debounce } from '../core/debounce';
import { playSound } from '../core/sound';
import { emit } from '../core/events';
import { settings } from '../core/state';

export interface WmWindow {
    el: HTMLElement;
    taskbarBtn: HTMLButtonElement | null;
    minimized: boolean;
    maximized: boolean;
    savedRect: { left: string; top: string; width: string; height: string } | null;
    geomRestored?: boolean;
    onClose?: () => void;
}

let wmZIndex = 200;
export const wmWindows: Record<string, WmWindow> = {};
export let activeWindowId: string | null = null;

/** Доступ к окну без сужения типов по индексу (паттерн «проверил → вернулся → взял»). */
export function wmGet(id: string): WmWindow | undefined {
    return wmWindows[id];
}

// Хук темы: преобразование иконки кнопки таскбара (macos подменяет набор иконок).
// Устанавливается features/themes, чтобы не было циклического импорта wm ↔ themes.
let taskbarIconTransform: ((id: string, iconHtml: string) => string) | null = null;
export function setTaskbarIconTransform(fn: ((id: string, iconHtml: string) => string) | null): void {
    taskbarIconTransform = fn;
}

// ==================== ГЕОМЕТРИЯ ОКОН ====================
// { [winId]: {l,t,w,h,max} }. Сохраняем ТОЛЬКО после действий пользователя
// (драг, ресайз, развернуть/вернуть). Запись переживает закрытие окна.

interface StoredGeom { l: number; t: number; w: number; h: number; max?: boolean }

function wmGeomLoad(): Record<string, StoredGeom> {
    return safeParse<Record<string, StoredGeom>>(localStorage.getItem(STORAGE.winGeom), {});
}

const persistGeoms = debounce((all: Record<string, StoredGeom>) => {
    setJSON(STORAGE.winGeom, all);
}, 250);

function wmGeomSave(id: string): void {
    const w = wmWindows[id];
    if (!w) return;
    let rect: StoredGeom;
    if (w.maximized && w.savedRect) {
        rect = {
            l: parseInt(w.savedRect.left, 10) || 0, t: parseInt(w.savedRect.top, 10) || 0,
            w: parseInt(w.savedRect.width, 10) || 0, h: parseInt(w.savedRect.height, 10) || 0,
        };
    } else {
        rect = { l: w.el.offsetLeft, t: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight };
    }
    rect.max = !!w.maximized;
    const all = wmGeomLoad();
    all[id] = rect;
    persistGeoms(all);
}

// Восстановление геометрии с клампом под текущий вьюпорт (тайтлбар остаётся досягаем).
// Возвращает null, если записи нет, иначе — был ли развёрнут (bool).
function wmGeomApply(id: string, win: HTMLElement): boolean | null {
    const g = wmGeomLoad()[id];
    if (!g) return null;
    const w = Math.min(g.w || 400, window.innerWidth);
    const h = Math.min(g.h || 300, window.innerHeight);
    const l = Math.min(Math.max(g.l || 0, 40 - w), Math.max(0, window.innerWidth - 60));
    const t = Math.min(Math.max(g.t || 0, 0), Math.max(0, window.innerHeight - 40));
    win.style.left = l + 'px'; win.style.top = t + 'px';
    win.style.width = w + 'px'; win.style.height = h + 'px';
    return !!g.max;
}

// ==================== СОЗДАНИЕ / ЖИЗНЕННЫЙ ЦИКЛ ====================

export function wmCreate(id: string, title: string, contentEl: HTMLElement | string, width = 400, height = 300, icon = '🖥️'): HTMLElement {
    if (wmWindows[id]) {
        emit('wm-dup-open', { id });
        wmRestore(id);
        wmFocus(id);
        return wmWindows[id].el;
    }

    const win = document.createElement('div');
    win.className = 'xp-window';
    win.id = 'win-' + id;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-labelledby', 'win-' + id + '-title');
    win.style.cssText = 'width:' + width + 'px;height:' + height + 'px;left:' +
        Math.floor(Math.random() * Math.min(Math.max(0, window.innerWidth - width - 60), 200) + 40) + 'px;top:' +
        Math.floor(Math.random() * Math.min(Math.max(0, window.innerHeight - height - 80), 120) + 20) + 'px;z-index:' + (++wmZIndex);

    const tb = document.createElement('div');
    tb.className = 'xp-titlebar';
    tb.innerHTML = '<span class="xp-titlebar-icon">' + icon + '</span><span class="xp-titlebar-title" id="win-' + id + '-title">' + escapeHtml(title) + '</span><div class="xp-win-btns"><button class="xp-btn xp-btn-min" title="Свернуть" aria-label="Свернуть">&#8211;</button><button class="xp-btn xp-btn-max" title="Развернуть" aria-label="Развернуть">&#9633;</button><button class="xp-btn xp-btn-close" title="Закрыть" aria-label="Закрыть">&#x2715;</button></div>';

    const c = document.createElement('div');
    c.className = 'xp-win-content';
    if (typeof contentEl === 'string') c.innerHTML = contentEl; else c.appendChild(contentEl);

    win.appendChild(tb);
    win.appendChild(c);
    // Прозрачные зоны ресайза по всем граням и углам
    const rzDirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    rzDirs.forEach(dir => {
        const h = document.createElement('div');
        h.className = 'xp-rz xp-rz-' + dir;
        win.appendChild(h);
        wmMakeResizable(win, h, dir);
    });
    document.body.appendChild(win);
    // Анимация появления
    win.classList.add('wm-appearing');
    setTimeout(() => { if (win.parentNode) win.classList.remove('wm-appearing'); }, 160);

    wmWindows[id] = { el: win, taskbarBtn: null, minimized: false, maximized: false, savedRect: null };
    wmMakeDraggable(win, tb);
    // Восстановление сохранённой пользователем геометрии (если двигали/ресайзили ранее)
    const geomMax = wmGeomApply(id, win);
    if (geomMax !== null) {
        wmWindows[id].geomRestored = true;
        if (geomMax) wmMaximize(id);
    }
    win.addEventListener('mousedown', () => { wmFocus(id); });
    tb.querySelector('.xp-btn-min')!.addEventListener('click', e => { e.stopPropagation(); wmMinimize(id); });
    tb.querySelector('.xp-btn-max')!.addEventListener('click', e => { e.stopPropagation(); wmMaximize(id); });
    tb.querySelector('.xp-btn-close')!.addEventListener('click', e => { e.stopPropagation(); wmClose(id); });
    tb.addEventListener('dblclick', () => { wmMaximize(id); });
    wmAddToTaskbar(id, title, icon);
    wmFocus(id);
    emit('wm-opened', { id, title });
    playSound('open');
    return win;
}

function wmGetChromeSize(winEl: HTMLElement): { w: number; h: number } {
    const content = winEl.querySelector<HTMLElement>('.xp-win-content');
    if (!content) return { w: 0, h: 0 };
    return {
        w: winEl.offsetWidth - content.clientWidth,
        h: winEl.offsetHeight - content.clientHeight,
    };
}

export function wmResizeToContent(id: string, contentW?: number | null, contentH?: number | null, minW?: number | null, minH?: number | null, maxW?: number | null, maxH?: number | null): void {
    const w = wmWindows[id];
    if (!w) return;
    if (w.geomRestored) return; // не затираем восстановленный пользователем размер
    const win = w.el;
    const content = win.querySelector<HTMLElement>('.xp-win-content')!;
    const chromeSize = wmGetChromeSize(win);
    // Если contentW/contentH не заданы — сохраняем текущий размер контента
    let nw = (contentW != null ? contentW : content.clientWidth) + chromeSize.w;
    let nh = (contentH != null ? contentH : content.clientHeight) + chromeSize.h;
    if (minW != null) nw = Math.max(minW, nw);
    if (minH != null) nh = Math.max(minH, nh);
    if (maxW != null) nw = Math.min(maxW, nw);
    if (maxH != null) nh = Math.min(maxH, nh);
    win.style.width = Math.round(nw) + 'px';
    win.style.height = Math.round(nh) + 'px';
}

export function wmFocus(id: string): void {
    if (!wmWindows[id]) return;
    Object.keys(wmWindows).forEach(k => {
        wmWindows[k].el.classList.add('inactive');
        if (wmWindows[k].taskbarBtn) wmWindows[k].taskbarBtn!.classList.remove('active');
    });
    activeWindowId = id;
    wmWindows[id].el.classList.remove('inactive');
    wmWindows[id].el.style.zIndex = String(++wmZIndex);
    if (wmWindows[id].taskbarBtn) wmWindows[id].taskbarBtn!.classList.add('active');
}

export function wmMinimize(id: string): void {
    if (!wmWindows[id]) return;
    const w = wmWindows[id];
    if (w.minimized) return;
    playSound('minimize');
    w.el.classList.add('wm-minimizing');
    if (w.taskbarBtn) w.taskbarBtn.classList.remove('active');
    activeWindowId = null;
    setTimeout(() => {
        if (!wmWindows[id]) return;
        w.el.style.display = 'none';
        w.el.classList.remove('wm-minimizing');
        w.minimized = true;
        emit('wm-changed');
    }, 185);
}

export function wmRestore(id: string): void {
    if (!wmWindows[id]) return;
    const w = wmWindows[id];
    playSound('restore');
    w.el.style.display = 'flex';
    w.minimized = false;
    w.el.classList.add('wm-restoring');
    setTimeout(() => { if (wmWindows[id]) w.el.classList.remove('wm-restoring'); }, 210);
}

export function wmMaximize(id: string): void {
    if (!wmWindows[id]) return;
    const w = wmWindows[id];
    if (w.maximized) {
        if (w.savedRect) {
            w.el.style.left = w.savedRect.left; w.el.style.top = w.savedRect.top;
            w.el.style.width = w.savedRect.width; w.el.style.height = w.savedRect.height;
        }
        w.maximized = false;
        w.el.classList.remove('maximized');
        w.el.querySelector('.xp-btn-max')!.innerHTML = '&#9633;';
    } else {
        w.savedRect = { left: w.el.style.left, top: w.el.style.top, width: w.el.style.width, height: w.el.style.height };
        // В теме macos разворачиваем под строку меню (26px), а не под таскбар
        w.el.style.cssText += (settings.theme === 'macos')
            ? ';left:0;top:26px;width:100vw;height:calc(100vh - 26px)'
            : ';left:0;top:0;width:100vw;height:calc(100vh - 40px)';
        w.maximized = true;
        w.el.classList.add('maximized');
        w.el.querySelector('.xp-btn-max')!.innerHTML = '&#10064;';
    }
    wmGeomSave(id);
}

export function wmClose(id: string): void {
    if (!wmWindows[id]) return;
    const w = wmWindows[id];
    playSound('close');
    w.el.classList.add('wm-closing');
    if (w.taskbarBtn) w.taskbarBtn.remove();
    if (activeWindowId === id) activeWindowId = null;
    if (typeof w.onClose === 'function') { try { w.onClose(); } catch { /* ignore */ } }
    setTimeout(() => {
        if (!wmWindows[id]) return;
        w.el.remove();
        delete wmWindows[id];
        emit('wm-closed', { id });
        emit('wm-changed');
    }, 125);
}

function wmAddToTaskbar(id: string, title: string, icon: string): void {
    const bar = document.getElementById('taskbar-windows');
    if (!bar) return;
    const btn = document.createElement('button');
    btn.className = 'taskbar-win-btn';
    const iconHtml = taskbarIconTransform ? taskbarIconTransform(id, icon) : icon;
    btn.innerHTML = '<span class="taskbar-btn-icon">' + iconHtml + '</span><span class="taskbar-btn-title">' + escapeHtml(title) + '</span>';
    btn.addEventListener('click', () => {
        if (!wmWindows[id]) return;
        if (wmWindows[id].minimized) { wmRestore(id); wmFocus(id); }
        else if (activeWindowId === id) wmMinimize(id);
        else wmFocus(id);
    });
    bar.appendChild(btn);
    wmWindows[id].taskbarBtn = btn;
}

// ==================== DRAG / RESIZE ====================

function wmMakeDraggable(win: HTMLElement, handle: HTMLElement): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains('xp-btn')) return;
        const id = win.id.replace('win-', '');
        if (wmWindows[id] && wmWindows[id].maximized) return;
        e.preventDefault();
        win.classList.add('wm-dragging'); // глушим iframe на время драга
        const sx = e.clientX, sy = e.clientY, sl = win.offsetLeft, st = win.offsetTop;
        function onM(ev: MouseEvent): void {
            win.style.left = (sl + ev.clientX - sx) + 'px';
            win.style.top = Math.max(0, st + ev.clientY - sy) + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            win.classList.remove('wm-dragging');
            wmGeomSave(id);
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });
}

// Ресайз за грань/угол: dir ∈ n,s,e,w,ne,nw,se,sw. При ресайзе за w/n
// двигаются и left/top; минимальный размер 200×120; у развёрнутого окна выключен.
function wmMakeResizable(win: HTMLElement, handle: HTMLElement, dir: string): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
        const id = win.id.replace('win-', '');
        if (wmWindows[id] && wmWindows[id].maximized) return;
        e.preventDefault();
        e.stopPropagation();
        win.classList.add('wm-dragging'); // глушим iframe на время ресайза
        const sx = e.clientX, sy = e.clientY, sw = win.offsetWidth, sh = win.offsetHeight, sl = win.offsetLeft, st = win.offsetTop;
        const dx = dir.indexOf('e') >= 0 ? 1 : (dir.indexOf('w') >= 0 ? -1 : 0);
        const dy = dir.indexOf('s') >= 0 ? 1 : (dir.indexOf('n') >= 0 ? -1 : 0);
        function onM(ev: MouseEvent): void {
            if (dx > 0) win.style.width = Math.max(200, sw + ev.clientX - sx) + 'px';
            else if (dx < 0) {
                const nw = Math.max(200, sw - (ev.clientX - sx));
                win.style.width = nw + 'px';
                win.style.left = (nw > 200 ? sl + ev.clientX - sx : sl + sw - 200) + 'px';
            }
            if (dy > 0) win.style.height = Math.max(120, sh + ev.clientY - sy) + 'px';
            else if (dy < 0) {
                const nh = Math.max(120, sh - (ev.clientY - sy));
                win.style.height = nh + 'px';
                win.style.top = Math.max(0, nh > 120 ? st + ev.clientY - sy : st + sh - 120) + 'px';
            }
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            win.classList.remove('wm-dragging');
            wmGeomSave(id);
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });
}

export function minimizeAll(): void {
    Object.keys(wmWindows).forEach(wmMinimize);
}

export function restoreAll(): void {
    Object.keys(wmWindows).forEach(id => {
        if (wmWindows[id].minimized) { wmRestore(id); wmFocus(id); }
    });
}
