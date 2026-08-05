// Системный трей: часы, календарь, громкость, индикатор обновлений —
// порт биндингов script.js:8514-8556 (без BSOD-пасхалки — не наша зона).

import './tray.css';
import { startClock } from './clock';
import { toggleCalendar } from './calendar';
import { toggleVolumePopup } from './volume';
import { initUpdateBell } from './updateBell';

export { updateClock, startClock } from './clock';
export { toggleCalendar } from './calendar';
export { toggleVolumePopup } from './volume';
export { setUpdateAvailable, getUpdateAvailable, initUpdateBell } from './updateBell';
export type { UpdateInfo } from './updateBell';

export function initTray(): void {
    startClock();

    // Календарь: клик по часам трея
    const trayClock = document.getElementById('tray-clock');
    if (trayClock) {
        trayClock.style.cursor = 'pointer';
        trayClock.addEventListener('click', (e) => { e.stopPropagation(); toggleCalendar(); });
    }

    // Клик по иконке громкости
    const trayVol = document.getElementById('tray-volume');
    if (trayVol) trayVol.addEventListener('click', (e) => { e.stopPropagation(); toggleVolumePopup(); });

    // Колокольчик обновлений
    initUpdateBell();
}
