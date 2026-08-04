// Глобальное состояние приложения: настройки, ярлыки, корзина, пользователь, выделение.
// Единственный модуль, который владеет этими данными; остальные читают/мутируют через API.

import { STORAGE } from './keys';
import { emit } from './events';
import { safeParse, getStr, getStrOrNull, getInt, getFloat, getBool, setItem, setJSON } from './store';
import type { LinkItem, Settings, TrashedLink, ViewMode, ThemeId, GlassPreset, SearchEngine } from './types';

// ==================== ЯРЛЫКИ / КОРЗИНА ====================

const DEFAULT_LINKS: LinkItem[] = [
    { name: 'Яндекс',  url: 'https://ya.ru' },
    { name: 'YouTube', url: 'https://youtube.com' },
];

export let links: LinkItem[] = safeParse<LinkItem[]>(getStrOrNull(STORAGE.tiles), DEFAULT_LINKS);
export let trashedLinks: TrashedLink[] = safeParse<TrashedLink[]>(getStrOrNull(STORAGE.trash), []);

export function setLinks(next: LinkItem[]): void {
    links = next;
}

export function setTrashedLinks(next: TrashedLink[]): void {
    trashedLinks = next;
}

/** Сериализация ярлыков: поле screenshot (включая вложенные папки) удаляется —
 *  скриншоты живут в chrome.storage.local, иначе localStorage переполнится. */
export function saveLinks(): void {
    function strip(item: LinkItem): LinkItem {
        const c: LinkItem = Object.assign({}, item);
        delete c.screenshot;
        if (c.items) c.items = c.items.map(strip);
        return c;
    }
    setJSON(STORAGE.tiles, links.map(strip));
    emit('links-changed');
}

export function saveTrash(): void {
    setJSON(STORAGE.trash, trashedLinks);
    emit('trash-changed');
}

// ==================== ПОЛЬЗОВАТЕЛЬ ====================

export let username: string = getStr(STORAGE.username, 'User');
export let userAvatar: string | null = getStrOrNull(STORAGE.avatar);

export function setUsername(name: string): void {
    username = name;
    setItem(STORAGE.username, name);
    emit('user-changed');
}

export function setUserAvatar(avatar: string | null): void {
    userAvatar = avatar;
    if (avatar === null) {
        try { localStorage.removeItem(STORAGE.avatar); } catch { /* ignore */ }
    } else {
        setItem(STORAGE.avatar, avatar);
    }
    emit('user-changed');
}

// ==================== ВЫДЕЛЕНИЕ ИКОНОК ====================

export const selectedIndices = new Set<number>(); // выделенные ярлыки
export const selectedSysIds = new Set<string>();  // выделенные системные иконки (компьютер, корзина, DOOM)
export const minimizedTiles = new Set<number>();  // indices плиток, свёрнутых в панель задач
export let minesweeperLosses = 0;

export function setMinesweeperLosses(n: number): void {
    minesweeperLosses = n;
}

export function selectIcon(index: number, ctrlKey: boolean): void {
    if (ctrlKey) {
        if (selectedIndices.has(index)) selectedIndices.delete(index);
        else selectedIndices.add(index);
    } else {
        selectedIndices.clear();
        selectedIndices.add(index);
    }
    emit('selection-changed');
}

export function clearSelection(): void {
    selectedIndices.clear();
    selectedSysIds.clear();
    emit('selection-changed');
}

// ==================== НАСТРОЙКИ ====================

export const settings: Settings = {
    tileWidth:  getInt(STORAGE.tileWidth, 130),
    tileHeight: getInt(STORAGE.tileHeight, 90),
    opacity:    getFloat(STORAGE.opacity, 0.9),
    blur:       getBool(STORAGE.blur, false),
    viewMode:   getStr(STORAGE.viewMode, 'glass') as ViewMode,
    snapToGrid: getBool(STORAGE.snapToGrid, true),
    iconSize:   getInt(STORAGE.iconSize, 80),
    glassTileWidth:  getInt(STORAGE.glassTileWidth, 120),
    glassTileHeight: getInt(STORAGE.glassTileHeight, 89),
    glassGap:       getInt(STORAGE.glassGap, 16),
    glassSnap:      getBool(STORAGE.glassSnap, true),
    glassPreset:    getStr(STORAGE.glassPreset, 'medium') as GlassPreset,
    glassCols:      getInt(STORAGE.glassCols, 5),
    glassBlur:      getBool(STORAGE.glassBlur, false),
    glassScreenshotBg: getBool(STORAGE.glassScreenshotBg, false),
    searchEngine:   getStr(STORAGE.searchEngine, 'ya') as SearchEngine,
    searchWidget:   getBool(STORAGE.searchWidget, true),
    doubleClickOpen: getBool(STORAGE.doubleClickOpen, false),
    theme:          getStr(STORAGE.theme, 'xp') as ThemeId,
    autoArrangeIcons: getBool(STORAGE.autoArrangeIcons, false),
};

// Миграция устаревших glass-настроек (IIFE из оригинала):
// если размер плитки не задан или старый «горизонтальный» — пересчитать из пресета.
(function migrateGlassTileSize(): void {
    function computePresetSize(preset: string, gap: number): number {
        const dw = window.innerWidth, g = gap || 16;
        const cols = ({ large: 3, medium: 5, small: 7 } as Record<string, number>)[preset] || 5;
        return Math.max(70, Math.min(300, Math.floor((dw - 32 + g) / cols - g)));
    }
    const needReset = !settings.glassTileWidth || settings.glassTileHeight <= 60;
    if (needReset) {
        const sz = computePresetSize(settings.glassPreset, settings.glassGap);
        settings.glassTileWidth = sz;
        settings.glassTileHeight = sz;
        setItem(STORAGE.glassTileWidth, String(sz));
        setItem(STORAGE.glassTileHeight, String(sz));
    }
})();

/** Маппинг поля настроек на ключ localStorage (каждая настройка хранится отдельным ключом — контракт оригинала). */
const SETTING_KEYS: { [K in keyof Settings]: string } = {
    tileWidth: STORAGE.tileWidth,
    tileHeight: STORAGE.tileHeight,
    opacity: STORAGE.opacity,
    blur: STORAGE.blur,
    viewMode: STORAGE.viewMode,
    snapToGrid: STORAGE.snapToGrid,
    iconSize: STORAGE.iconSize,
    glassTileWidth: STORAGE.glassTileWidth,
    glassTileHeight: STORAGE.glassTileHeight,
    glassGap: STORAGE.glassGap,
    glassSnap: STORAGE.glassSnap,
    glassPreset: STORAGE.glassPreset,
    glassCols: STORAGE.glassCols,
    glassBlur: STORAGE.glassBlur,
    glassScreenshotBg: STORAGE.glassScreenshotBg,
    searchEngine: STORAGE.searchEngine,
    searchWidget: STORAGE.searchWidget,
    doubleClickOpen: STORAGE.doubleClickOpen,
    theme: STORAGE.theme,
    autoArrangeIcons: STORAGE.autoArrangeIcons,
};

/** Изменить настройку и персистить её ключ. */
export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    settings[key] = value;
    setItem(SETTING_KEYS[key], String(value));
    emit('settings-changed', { key });
}
