// Системные иконки рабочего стола: Мой компьютер, Корзина, DOOM.
// Порт секции SYSTEM ICONS (script.js:2003-2146).
// Хранятся отдельно от links[] (ключи edge_sysicon_<id>), в папки их тащить нельзя.

import { KEY_SYSICON_PREFIX } from '../../core/keys';
import { safeParse, setJSON } from '../../core/store';
import { escapeHtml, xpIconHtml } from '../../core/dom';
import { snapPos } from '../../core/grid';
import { selectedIndices, selectedSysIds, settings, trashedLinks } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { beginGroupDrag } from './dragDrop';
import { updateSelectionUI } from './selection';

export interface SysIconDef {
    id: string;
    name: string;
}

export const SYSTEM_ICONS_DEF: SysIconDef[] = [
    { id: 'mycomputer', name: 'Мой компьютер' },
    { id: 'recycle',    name: 'Корзина'        },
    { id: 'doom',       name: 'DOOM'           },
];

interface SysPos { x: number; y: number; dw?: number; dh?: number }

function desktopSize(): { dw: number; dh: number } {
    const desktop = document.getElementById('desktop');
    return {
        dw: desktop ? desktop.offsetWidth : (window.innerWidth || 1200),
        dh: desktop ? desktop.offsetHeight : (window.innerHeight - 44 || 800),
    };
}

function getSysIconPos(id: string, slotIndex: number): SysPos {
    const raw = localStorage.getItem(KEY_SYSICON_PREFIX + id);
    if (raw) {
        const parsed = safeParse<SysPos | null>(raw, null);
        if (parsed) return parsed;
    }
    const { dw, dh } = desktopSize();
    return { x: Math.max(0, dw - 84), y: 10 + slotIndex * 90, dw: dw, dh: dh };
}

function getSysIconDisplayPos(id: string, slotIndex: number): { x: number; y: number } {
    const pos = getSysIconPos(id, slotIndex);
    const { dw: cw, dh: ch } = desktopSize();
    const refW = pos.dw || cw;
    const refH = pos.dh || ch;
    return { x: pos.x * (cw / refW), y: pos.y * (ch / refH) };
}

export function saveSysIconPos(id: string, x: number, y: number, dw: number, dh: number): void {
    setJSON(KEY_SYSICON_PREFIX + id, { x: x, y: y, dw: dw, dh: dh });
}

function getSysIconImg(id: string): string {
    if (id === 'mycomputer') {
        // В теме macos — Macintosh HD
        if (settings.theme === 'macos') return '<img class="xp-icon-img" src="icons/mac/harddisk.png" width="48" height="48" alt="">';
        return xpIconHtml('my-computer', 48);
    }
    if (id === 'recycle') {
        return xpIconHtml(trashedLinks.length === 0 ? 'recycle-bin-empty' : 'recycle-bin', 48);
    }
    if (id === 'doom') {
        return xpIconHtml('doom', 48);
    }
    return '';
}

function openSysIcon(id: string): void {
    if (id === 'mycomputer') runAction(ACTION.openMyComputer);
    else if (id === 'recycle') runAction(ACTION.openRecycle);
    else if (id === 'doom') runAction(ACTION.openDoom);
}

export function createSystemIcon(def: SysIconDef, slotIndex: number): HTMLElement {
    const dispPos = getSysIconDisplayPos(def.id, slotIndex);

    const icon = document.createElement('div');
    icon.className = 'desktop-icon sys-icon xp-icon';
    icon.dataset.sysId = def.id;
    icon.style.cssText = 'position:absolute; left:' + dispPos.x + 'px; top:' + dispPos.y + 'px;';

    // В теме macos «Мой компьютер» подписан как Macintosh HD
    const label = (settings.theme === 'macos' && def.id === 'mycomputer') ? 'Macintosh HD' : def.name;
    icon.innerHTML =
        '<div class="xp-icon-img-wrapper">' + getSysIconImg(def.id) + '</div>' +
        '<span class="xp-icon-label">' + escapeHtml(label) + '</span>';

    const iconExt = icon as HTMLElement & { _wasDragged?: boolean };

    icon.addEventListener('click', (e: MouseEvent) => {
        if (iconExt._wasDragged) { iconExt._wasDragged = false; return; }
        // Ctrl+клик — переключить выделение системной иконки, не открывая её
        if (e.ctrlKey) {
            if (selectedSysIds.has(def.id)) selectedSysIds.delete(def.id);
            else selectedSysIds.add(def.id);
            updateSelectionUI();
            return;
        }
        // Обычный клик — выделить только эту иконку (как у ярлыков)
        selectedIndices.clear();
        selectedSysIds.clear();
        selectedSysIds.add(def.id);
        updateSelectionUI();
        if (!settings.doubleClickOpen) openSysIcon(def.id);
    });
    icon.addEventListener('dblclick', () => {
        if (settings.doubleClickOpen) openSysIcon(def.id);
    });

    // Drag (групповой — через общий механизм dragDrop, одиночный — локальный)
    icon.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        if (selectedSysIds.has(def.id) && (selectedIndices.size + selectedSysIds.size) > 1) {
            beginGroupDrag(icon, e);
            return;
        }
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        // Стартовая позиция — текущая визуальная (масштабированная)
        const iX = parseFloat(icon.style.left) || 0;
        const iY = parseFloat(icon.style.top) || 0;
        let moved = false;
        icon.style.zIndex = '999';

        function onMove(ev: MouseEvent): void {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
            moved = true;
            icon.classList.add('dragging');
            const { dw, dh } = desktopSize();
            let x = iX + dx, y = iY + dy;
            x = Math.max(0, Math.min(x, dw - icon.offsetWidth));
            y = Math.max(0, Math.min(y, dh - icon.offsetHeight));
            icon.style.left = x + 'px';
            icon.style.top = y + 'px';
        }
        function onUp(ev: MouseEvent): void {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            icon.classList.remove('dragging');
            icon.style.zIndex = '';
            if (moved) {
                const dx = ev.clientX - startX, dy = ev.clientY - startY;
                const { dw, dh } = desktopSize();
                let x = iX + dx, y = iY + dy;
                x = Math.max(0, Math.min(x, dw - icon.offsetWidth));
                y = Math.max(0, Math.min(y, dh - icon.offsetHeight));
                if (settings.snapToGrid) { const sp = snapPos(x, y); x = sp.x; y = sp.y; }
                saveSysIconPos(def.id, x, y, dw, dh);
                icon.style.left = x + 'px';
                icon.style.top = y + 'px';
                iconExt._wasDragged = true;
            }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    return icon;
}
