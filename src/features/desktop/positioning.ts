// Пропорциональное позиционирование иконок, auto-arrange, anti-overlap.
// Порт секций PROPORTIONAL POSITIONING / ICON DIMENSIONS / AUTO-ARRANGE / ANTI-OVERLAP
// оригинального script.js (~608-796).

import { GRID_MARGIN, SNAP_TILE, TITLEBAR_H, getPosKey, getSnap, snapPos } from '../../core/grid';
import { links, saveLinks, settings } from '../../core/state';
import type { LinkItem, LinkPosition } from '../../core/types';

// Расширенные поля ярлыка, которые есть в данных оригинала,
// но отсутствуют в core/types.ts (per-tile размеры, спаны glass-папок, кастомная иконка).
export interface LinkItemExt extends LinkItem {
    w?: number;
    h?: number;
    colSpan?: number;
    rowSpan?: number;
    customIcon?: string;
}

export function asExt(item: LinkItem): LinkItemExt {
    return item as LinkItemExt;
}

// Счётчик элементов для вертикального центрирования glass-сетки
// (в оригинале — window._glassItemCount; глобалы на window запрещены, живёт здесь).
let glassItemCount = 1;

export function setGlassItemCount(n: number): void {
    glassItemCount = n;
}

function desktopSize(): { dw: number; dh: number } {
    const desktop = document.getElementById('desktop');
    return {
        dw: desktop ? desktop.offsetWidth : window.innerWidth,
        dh: desktop ? desktop.offsetHeight : (window.innerHeight - 44),
    };
}

// ==================== PROPORTIONAL POSITIONING ====================
// Каждый элемент хранит posIcon / posGlass / posTile: {x, y, dw, dh} — по одному на режим.
// x/y — пиксели на момент сохранения; dw/dh — размер рабочего стола в тот момент.
// При рендере позиции масштабируются → иконки возвращаются пропорционально после resize.
export function getDisplayPos(item: LinkItem | null): { x: number; y: number } {
    const { dw: cw, dh: ch } = desktopSize();
    const pos = item ? item[getPosKey()] : null;
    const refW = (pos && pos.dw) ? pos.dw : cw;
    const refH = (pos && pos.dh) ? pos.dh : ch;
    return {
        x: (pos && pos.x !== undefined) ? pos.x * (cw / refW) : 0,
        y: (pos && pos.y !== undefined) ? pos.y * (ch / refH) : 0,
    };
}

// ==================== ICON DIMENSIONS ====================
export function getIconDim(item: LinkItem | null): { w: number; h: number } {
    if (settings.viewMode === 'icon') {
        const sz = settings.iconSize;
        return { w: sz, h: Math.round(sz * 1.1) };
    }
    if (settings.viewMode === 'glass') return { w: settings.glassTileWidth, h: settings.glassTileHeight };
    const ext = item ? asExt(item) : null;
    const w = (ext && ext.w) ? ext.w : settings.tileWidth;
    const h = (ext && ext.h) ? ext.h : settings.tileHeight;
    return { w: w, h: h + TITLEBAR_H };
}

// ==================== AUTO-ARRANGE (assign positions) ====================
// Константы glass-сетки
export const GLASS_MARGIN = 16;
export const GLASS_TOP = 90;

export interface GlassGrid {
    cellW: number;
    cellH: number;
    cols: number;
    startX: number;
    startY: number;
    gap: number;
}

export function getGlassGrid(dw: number, dh: number): GlassGrid {
    const gap = settings.glassGap || 16;
    const cellW = settings.glassTileWidth + gap;
    const cellH = settings.glassTileHeight + gap;
    const cols = Math.max(1, Math.floor((dw - GLASS_MARGIN * 2 + gap) / cellW));
    const startX = Math.max(GLASS_MARGIN, Math.floor((dw - cols * cellW + gap) / 2));
    // Вертикальное центрирование
    let startY = GLASS_TOP;
    if (dh) {
        const rows = Math.ceil((glassItemCount || 1) / cols);
        const totalH = rows * cellH - gap;
        const availH = dh - GLASS_TOP;
        if (availH > totalH) startY = GLASS_TOP + Math.floor((availH - totalH) / 2);
    }
    return { cellW: cellW, cellH: cellH, cols: cols, startX: startX, startY: startY, gap: gap };
}

export function assignPositions(forceAll: boolean): void {
    const GAP = 8, MARGIN = 10;
    const { dw } = desktopSize();
    const dh = desktopSize().dh - GAP;
    const pk = getPosKey();

    if (settings.viewMode === 'glass') {
        glassItemCount = links.length;
        const g = getGlassGrid(dw, dh);
        let col = 0, row = 0;
        links.forEach(item => {
            if (forceAll || !item[pk]) {
                item[pk] = {
                    x: g.startX + col * g.cellW,
                    y: g.startY + row * g.cellH,
                    dw: dw, dh: dh + GAP,
                };
            }
            col++;
            if (col >= g.cols) { col = 0; row++; }
        });
    } else {
        let x = MARGIN, y = MARGIN;
        links.forEach(item => {
            if (forceAll || !item[pk]) {
                item[pk] = { x: x, y: y, dw: dw, dh: dh + GAP };
            }
            const dim = getIconDim(item);
            y += dim.h + GAP;
            if (y + dim.h > dh) { y = MARGIN; x += dim.w + GAP; }
        });
    }
}

// Полная перекладка по списку (пункт меню «Упорядочить иконки»).
// renderDesktop импортируется лениво — вызов только по действию пользователя,
// цикла на старте нет.
export function autoArrange(renderFn: () => void): void {
    assignPositions(true);
    saveLinks();
    renderFn();
}

// Выровнять по сетке (одноразовое действие): каждую иконку прижать к ближайшей
// свободной ячейке КАНОНИЧЕСКОЙ сетки, СОХРАНЯЯ визуальный порядок (сверху вниз,
// слева направо). В отличие от autoArrange — не компактная перекладка по списку.
// Имеет смысл только в режиме «Ярлыки» (единый размер иконок); в остальных — autoArrange.
export function alignToGrid(renderFn: () => void): void {
    if (settings.viewMode !== 'icon') { autoArrange(renderFn); return; }
    const { dw, dh } = desktopSize();
    const pk = getPosKey();
    const cell = getSnap();

    // Препятствия: системные иконки (компьютер, корзина, DOOM) занимают свои ячейки
    const used = new Set<string>();
    document.querySelectorAll<HTMLElement>('.sys-icon').forEach(el => {
        const l = parseFloat(el.style.left) || 0, t = parseFloat(el.style.top) || 0;
        used.add(Math.round((l - GRID_MARGIN) / cell) + ':' + Math.round((t - GRID_MARGIN) / cell));
    });

    // Текущий визуальный порядок иконок
    const order = links.map(item => ({ item: item, pos: (item[pk] || { x: 0, y: 0 }) as LinkPosition }));
    order.sort((a, b) => (a.pos.y - b.pos.y) || (a.pos.x - b.pos.x));

    order.forEach(e => {
        const dim = getIconDim(e.item);
        const maxCx = Math.max(0, Math.floor((dw - GRID_MARGIN - dim.w) / cell));
        const maxCy = Math.max(0, Math.floor((dh - GRID_MARGIN - dim.h) / cell));
        const cx = Math.min(maxCx, Math.max(0, Math.round((e.pos.x - GRID_MARGIN) / cell)));
        const cy = Math.min(maxCy, Math.max(0, Math.round((e.pos.y - GRID_MARGIN) / cell)));
        // Ищем ближайшую свободную ячейку кольцами вокруг (cx, cy)
        let best: { x: number; y: number } | null = null, bestD = Infinity;
        for (let r = 0; r <= 60; r++) {
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx > maxCx || ny > maxCy) continue;
                const key = nx + ':' + ny;
                if (used.has(key)) continue;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
            }
            if (best) break;
        }
        if (!best) best = { x: cx, y: cy };
        used.add(best.x + ':' + best.y);
        e.item[pk] = { x: GRID_MARGIN + best.x * cell, y: GRID_MARGIN + best.y * cell, dw: dw, dh: dh };
    });
    saveLinks();
    renderFn();
}

// ==================== ANTI-OVERLAP: find nearest free position ====================
// Возвращает {x, y} в точке (x, y) или рядом, где нет перекрытия с иконками стола.
// excludeEls: Set DOM-элементов, которые игнорируем (те, что сейчас размещаем).
export function findFreePosition(x: number, y: number, w: number, h: number, excludeEls: Set<HTMLElement> | null): { x: number; y: number } {
    const container = document.getElementById('desktop');
    if (!container) return { x: x, y: y };
    const dw = container.offsetWidth, dh = container.offsetHeight;
    const pad = 4;
    const occupied: { l: number; t: number; r: number; b: number }[] = [];
    document.querySelectorAll<HTMLElement>('.desktop-icon').forEach(el => {
        if (excludeEls && excludeEls.has(el)) return;
        const l = parseFloat(el.style.left) || 0;
        const t = parseFloat(el.style.top) || 0;
        occupied.push({ l: l - pad, t: t - pad, r: l + el.offsetWidth + pad, b: t + el.offsetHeight + pad });
    });
    function collides(cx: number, cy: number): boolean {
        return occupied.some(r => cx < r.r && cx + w > r.l && cy < r.b && cy + h > r.t);
    }
    if (!collides(x, y)) return { x: x, y: y };
    const step = Math.max(SNAP_TILE, 10);
    for (let dist = step; dist < Math.max(dw, dh) * 2; dist += step) {
        for (let ox = -dist; ox <= dist; ox += step) {
            for (let oy = -dist; oy <= dist; oy += step) {
                if (Math.abs(ox) < dist && Math.abs(oy) < dist) continue;
                let nx = Math.max(0, Math.min(x + ox, dw - w));
                let ny = Math.max(0, Math.min(y + oy, dh - h));
                // Snap ДО проверки коллизии — иначе округлённая позиция могла налезть
                if (settings.snapToGrid) {
                    const sp = snapPos(nx, ny);
                    nx = Math.max(0, Math.min(sp.x, dw - w));
                    ny = Math.max(0, Math.min(sp.y, dh - h));
                }
                if (!collides(nx, ny)) {
                    return { x: nx, y: ny };
                }
            }
        }
    }
    return { x: x, y: y };
}
