// Каноническая сетка рабочего стола (порт секций CANONICAL GRID / STORAGE KEYS).
// Единая сетка одна на всех: ярлыки и системные иконки обязаны идти через snapPos(),
// локальных округлений вида Math.round(x / s) * s в коде быть не должно.

import { settings } from './state';
import type { ViewMode } from './types';

export const SNAP_TILE = 10;   // tile/window mode: fine-grid snap (px)
export const ICON_W = 80;      // icon mode: rendered icon width  (px)
export const ICON_H = 88;      // icon mode: rendered icon height (px)
export const ICON_CELL = 96;   // icon mode: grid cell = icon + gap (px)
export const TITLEBAR_H = 19;  // tile titlebar height (px)
export const GRID_MARGIN = 10; // начало координат сетки (как у auto-arrange)

/** Mode-specific position key: posIcon (icon mode), posGlass (glass mode) или posTile (tile mode). */
export function getPosKey(viewMode: ViewMode = settings.viewMode): 'posIcon' | 'posGlass' | 'posTile' {
    if (viewMode === 'icon') return 'posIcon';
    if (viewMode === 'glass') return 'posGlass';
    return 'posTile';
}

/** Snap size: icon-cell в icon mode, 16px в glass mode, fine в tile mode; 1 при выключенной привязке. */
export function getSnap(): number {
    if (!settings.snapToGrid) return 1;
    if (settings.viewMode === 'icon') return settings.iconSize + 16;
    if (settings.viewMode === 'glass') return 16;
    return SNAP_TILE;
}

/** Чистая функция привязки к сетке (вынесена от настроек для тестируемости). */
export function snapTo(x: number, y: number, cell: number): { x: number; y: number } {
    const c = cell || 1;
    return {
        x: GRID_MARGIN + Math.round((x - GRID_MARGIN) / c) * c,
        y: GRID_MARGIN + Math.round((y - GRID_MARGIN) / c) * c,
    };
}

/** Привязка к канонической сетке по текущим настройкам. */
export function snapPos(x: number, y: number): { x: number; y: number } {
    return snapTo(x, y, getSnap());
}
