// Общие типы данных расширения.

export type ViewMode = 'glass' | 'window' | 'icon';
export type ThemeId = 'xp' | 'macos';
export type GlassPreset = 'large' | 'medium' | 'small';
export type SearchEngine = 'ya' | 'go';

/** Позиция элемента рабочего стола; dw/dh — размеры рабочего стола при сохранении (пропорциональное позиционирование). */
export interface LinkPosition {
    x: number;
    y: number;
    dw?: number;
    dh?: number;
}

/** Ярлык или папка на рабочем столе. */
export interface LinkItem {
    name: string;
    url?: string;
    icon?: string;          // dataURL пользовательской иконки
    customIcon?: string;    // пользовательская иконка (поле оригинала; приоритет над favicon)
    screenshot?: string;    // dataURL превью (НЕ сериализуется в localStorage — живёт в chrome.storage.local)
    app?: boolean;          // открывать в окне веб-приложения (IE6), а не во вкладке
    isFolder?: boolean;
    items?: LinkItem[];     // содержимое папки
    posIcon?: LinkPosition;
    posGlass?: LinkPosition;
    posTile?: LinkPosition;
}

/** Элемент корзины — ярлык + служебные поля. */
export interface TrashedLink extends LinkItem {
    deletedAt?: number;   // timestamp удаления
    origIndex?: number;   // позиция в links до удаления (для восстановления)
}

export interface Settings {
    tileWidth: number;
    tileHeight: number;
    opacity: number;
    blur: boolean;
    viewMode: ViewMode;
    snapToGrid: boolean;
    iconSize: number;
    glassTileWidth: number;
    glassTileHeight: number;
    glassGap: number;
    glassSnap: boolean;
    glassPreset: GlassPreset;
    glassCols: number;
    glassBlur: boolean;
    glassScreenshotBg: boolean;
    searchEngine: SearchEngine;
    searchWidget: boolean;
    doubleClickOpen: boolean;
    theme: ThemeId;
    autoArrangeIcons: boolean;
}

/** Стикер (Post-it). */
export interface StickyNote {
    id: string;           // 'sticky_<timestamp>'
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    colorIdx: number;     // индекс в палитре STICKY_COLORS
}

/** Геометрия окна, персистится в xp_window_geom. */
export interface WindowGeom {
    x: number;
    y: number;
    w: number;
    h: number;
    maximized?: boolean;
}

/** Пункт контекстного меню (движок features/contextmenu). */
export interface ContextMenuItem {
    label?: string;
    icon?: string;        // HTML-строка иконки (xpIconHtml) — доверенная, генерируется нами
    action?: () => void;
    submenu?: ContextMenuItem[];
    checked?: boolean;
    disabled?: boolean;
    danger?: boolean;
    separator?: boolean;
}

/** Публичный интерфейс встроенного приложения. */
export interface App {
    id: string;
    title: string;
    icon: string;   // имя png из icons/ (без размера и расширения)
    open(): void;
}
