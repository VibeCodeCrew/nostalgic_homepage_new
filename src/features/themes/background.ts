// Фон рабочего стола: темо-зависимые обои по умолчанию (порт BACKGROUND, script.js:1456-1469).
// Пользовательский фон (edge_custom_bg) побеждает в любой теме.
// Маркер MARKER_CUSTOM означает: dataURL лежит в chrome.storage.local (фикс аудита #3).

import { STORAGE, KEY_CUSTOM_BG_DATA, MARKER_CUSTOM } from '../../core/keys';
import { getStrOrNull } from '../../core/store';
import { settings } from '../../core/state';
import { readMigratedBlob } from '../../core/screenshots';

const DEFAULT_BG_XP = 'wprs/WiXP.jpg';
const DEFAULT_BG_MACOS = 'wprs/AquaBlue.jpg';

function defaultBg(): string {
    return settings.theme === 'macos' ? DEFAULT_BG_MACOS : DEFAULT_BG_XP;
}

function setDesktopBg(bg: string): void {
    const d = document.getElementById('desktop');
    if (!d) return;
    d.style.backgroundImage = 'url(\'' + bg + '\')';
    d.style.backgroundSize = 'cover';
    d.style.backgroundPosition = 'center';
}

export function applyBackground(): void {
    // Пользовательский фон имеет приоритет в любой теме; иначе — дефолт темы
    const custom = getStrOrNull(STORAGE.bg);
    if (custom === MARKER_CUSTOM) {
        // Асинхронный путь: dataURL мигрирован в chrome.storage.local
        readMigratedBlob(KEY_CUSTOM_BG_DATA, dataUrl => { setDesktopBg(dataUrl || defaultBg()); });
        return;
    }
    // Синхронный путь: путь строкой (или дефолт темы)
    setDesktopBg(custom || defaultBg());
}
