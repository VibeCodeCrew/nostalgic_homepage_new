// Фон рабочего стола: темо-зависимые обои по умолчанию (порт BACKGROUND, script.js:1456-1469).
// Пользовательский фон (edge_custom_bg) побеждает в любой теме.

import { STORAGE } from '../../core/keys';
import { getStrOrNull } from '../../core/store';
import { settings } from '../../core/state';

const DEFAULT_BG_XP = 'wprs/WiXP.jpg';
const DEFAULT_BG_MACOS = 'wprs/AquaBlue.jpg';

export function applyBackground(): void {
    // Пользовательский фон имеет приоритет в любой теме; иначе — дефолт темы
    const custom = getStrOrNull(STORAGE.bg);
    const bg = custom || (settings.theme === 'macos' ? DEFAULT_BG_MACOS : DEFAULT_BG_XP);
    const d = document.getElementById('desktop');
    if (!d) return;
    d.style.backgroundImage = 'url(\'' + bg + '\')';
    d.style.backgroundSize = 'cover';
    d.style.backgroundPosition = 'center';
}
