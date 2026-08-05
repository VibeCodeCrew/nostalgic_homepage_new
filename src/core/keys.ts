// Все ключи хранилищ — единственное место в проекте.
// ВАЖНО: имена ключей — контракт паритета с оригиналом, менять нельзя,
// иначе существующие пользователи потеряют данные.

export const STORAGE = {
    tiles:      'edge_tiles',
    addBtnPos:  'edge_addbtn_pos',   // legacy, в оригинале не используется — оставлен для совместимости
    cols:       'edge_cols',         // legacy, фигурирует только в export/import
    tileWidth:  'edge_tile_width',
    tileHeight: 'edge_tile_height',
    opacity:    'edge_tile_opacity',
    blur:       'edge_tile_blur',
    bg:         'edge_custom_bg',
    trash:      'edge_trash',
    username:   'edge_username',
    notepad:    'edge_notepad',
    viewMode:   'edge_view_mode',
    snapToGrid: 'edge_snap_grid',
    posGlass:       'edge_pos_glass',
    iconSize:       'edge_icon_size',
    glassTileWidth: 'edge_glass_tile_width',
    glassTileHeight:'edge_glass_tile_height',
    glassGap:       'edge_glass_gap',
    glassSnap:      'edge_glass_snap',
    glassPreset:    'edge_glass_preset',
    glassCols:      'edge_glass_cols',
    glassBlur:      'edge_glass_blur',
    glassScreenshotBg: 'edge_glass_screenshot_bg',
    avatar:         'xp_avatar',
    searchEngine:     'edge_search_engine',
    searchWidget:     'edge_search_widget',
    searchWidgetPos:  'edge_search_widget_pos',
    doubleClickOpen:  'edge_double_click_open',
    theme:            'edge_theme',
    dockItems:        'edge_dock_items',
    autoArrangeIcons: 'edge_auto_arrange',
    winGeom:          'xp_window_geom',
} as const;

// Ключи вне объекта STORAGE в оригинале
export const KEY_VOLUME = 'edge_volume';
export const KEY_SETUP_DONE = 'xp_setup_done';
export const KEY_STICKIES = 'edge_stickies';
export const KEY_URL_HISTORY = 'edge_url_history';
export const KEY_DOOM_SAVES = 'doom_saves_v2';
export const KEY_DOOM_AUDIO = 'doom_audio_v1';
export const KEY_WORDPAD_CONTENT = 'edge_wordpad_content';
export const KEY_SYSICON_PREFIX = 'edge_sysicon_';

// chrome.storage.local
export const SS_PREFIX = 'ss_';            // скриншоты сайтов: ss_<url>
export const KEY_CUSTOM_BG_DATA = 'custom_bg_data';   // dataURL фона (мигрирован из edge_custom_bg)
export const KEY_AVATAR_CUSTOM = 'xp_avatar_custom';  // dataURL пользовательского аватара

// Маркеры в localStorage, заменяющие перенесённые в chrome.storage.local данные
export const MARKER_CUSTOM = 'custom';
