// Импорт/экспорт настроек и фон рабочего стола — порт IMPORT / EXPORT (script.js:6029-6045).
// ФИКС АУДИТА #4: импортируемые edge_tiles прогоняются через isSafeUrl (javascript: и т.п.).
// ФИКС АУДИТА #3: dataURL фона — в chrome.storage.local (KEY_CUSTOM_BG_DATA), в edge_custom_bg — маркер.

import { STORAGE, KEY_CUSTOM_BG_DATA, MARKER_CUSTOM } from '../../core/keys';
import { getStrOrNull, setItem } from '../../core/store';
import { registerAction, ACTION } from '../../core/actions';
import { isSafeUrl } from '../../core/url';
import { applyBackground } from '../themes';
import type { LinkItem } from '../../core/types';

export function exportData(): void {
    const data = {
        edge_tiles: getStrOrNull(STORAGE.tiles),
        edge_cols: getStrOrNull(STORAGE.cols),
        edge_tile_width: getStrOrNull(STORAGE.tileWidth),
        edge_tile_height: getStrOrNull(STORAGE.tileHeight),
        edge_tile_opacity: getStrOrNull(STORAGE.opacity),
        edge_tile_blur: getStrOrNull(STORAGE.blur),
        edge_custom_bg: getStrOrNull(STORAGE.bg),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'edge_startpage_backup.json'; a.click();
    URL.revokeObjectURL(url);
}

/**
 * ФИКС АУДИТА #4: чистка импортируемых ярлыков.
 * Решение: ярлык с небезопасным url (javascript:, data: и т.п.) УДАЛЯЕТСЯ целиком —
 * восстановить из него осмысленный https-адрес нельзя (у javascript:-URL нет hostname),
 * а оставлять исполняемую схему опасно. Папки сохраняются, чистятся рекурсивно.
 */
function sanitizeImportedLinks(items: LinkItem[]): LinkItem[] {
    const out: LinkItem[] = [];
    items.forEach(item => {
        if (item && item.isFolder) {
            const folder = Object.assign({}, item);
            folder.items = sanitizeImportedLinks(item.items || []);
            out.push(folder);
        } else if (item && (!item.url || isSafeUrl(item.url))) {
            out.push(item);
        }
    });
    return out;
}

function bindImportUpload(): void {
    const inp = document.getElementById('import-upload') as HTMLInputElement | null;
    if (!inp) return;
    inp.addEventListener('change', () => {
        const file = inp.files && inp.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(String(ev.target!.result));
                if (d.edge_tiles) {
                    let tilesRaw = String(d.edge_tiles);
                    try {
                        const parsed = JSON.parse(tilesRaw);
                        if (Array.isArray(parsed)) tilesRaw = JSON.stringify(sanitizeImportedLinks(parsed));
                    } catch { /* не JSON-массив — пишем как есть, парсинг на старте переживёт */ }
                    setItem(STORAGE.tiles, tilesRaw);
                }
                if (d.edge_cols) setItem(STORAGE.cols, String(d.edge_cols));
                if (d.edge_tile_width) setItem(STORAGE.tileWidth, String(d.edge_tile_width));
                if (d.edge_tile_height) setItem(STORAGE.tileHeight, String(d.edge_tile_height));
                if (d.edge_tile_opacity) setItem(STORAGE.opacity, String(d.edge_tile_opacity));
                if (d.edge_tile_blur) setItem(STORAGE.blur, String(d.edge_tile_blur));
                if (d.edge_custom_bg) setItem(STORAGE.bg, String(d.edge_custom_bg));
                location.reload();
            } catch (err) {
                alert('Ошибка при чтении файла');
            }
        };
        r.readAsText(file);
        inp.value = '';
    });
}

function bindBgUpload(): void {
    const inp = document.getElementById('bg-upload') as HTMLInputElement | null;
    if (!inp) return;
    inp.addEventListener('change', () => {
        const file = inp.files && inp.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = ev => {
            const dataUrl = String(ev.target!.result || '');
            if (!dataUrl) return;
            // ФИКС АУДИТА #3: большой dataURL — в chrome.storage.local, в localStorage только маркер
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ [KEY_CUSTOM_BG_DATA]: dataUrl }, () => {
                    if (chrome.runtime.lastError) {
                        // Откат: храним по-старому в localStorage, чтобы не потерять фон
                        setItem(STORAGE.bg, dataUrl);
                        applyBackground();
                        return;
                    }
                    setItem(STORAGE.bg, MARKER_CUSTOM);
                    applyBackground();
                });
            } else {
                // Fallback для dev-страницы вне расширения
                setItem(STORAGE.bg, dataUrl);
                applyBackground();
            }
        };
        r.readAsDataURL(file);
        inp.value = '';
    });
}

export function initImportExport(): void {
    registerAction(ACTION.exportData, exportData);
    registerAction(ACTION.importData, () => { document.getElementById('import-upload')!.click(); });
    bindImportUpload();
    bindBgUpload();
}
