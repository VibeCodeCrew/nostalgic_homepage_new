// Попап громкости в трее — порт VOLUME POPUP (script.js:3506-3544).
// Громкость хранится/применяется через core/sound (edge_volume + master gain).

import { xpIconHtml } from '../../core/dom';
import { getVolume, setVolume } from '../../core/sound';

export function toggleVolumePopup(): void {
    const existing = document.getElementById('xp-volume-popup');
    if (existing) { existing.remove(); return; }
    const popup = document.createElement('div');
    popup.id = 'xp-volume-popup';
    popup.className = 'xp-volume-popup';
    const curVol = getVolume();
    const lbl = document.createElement('label');
    lbl.innerHTML = xpIconHtml('volume', 16);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = String(curVol);
    const valLbl = document.createElement('label');
    valLbl.textContent = Math.round(curVol * 100) + '%';
    popup.appendChild(lbl);
    popup.appendChild(slider);
    popup.appendChild(valLbl);
    document.body.appendChild(popup);
    const tvEl = document.getElementById('tray-volume');
    if (tvEl) {
        const r = tvEl.getBoundingClientRect();
        popup.style.bottom = (window.innerHeight - r.top + 2) + 'px';
        popup.style.left = r.left + 'px';
    }
    function updateVolIcon(v: number): void {
        if (tvEl) tvEl.innerHTML = v === 0 ? xpIconHtml('volume-mute', 16) : xpIconHtml('volume', 16);
    }
    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        setVolume(v); // пишет edge_volume и обновляет master gain
        valLbl.textContent = Math.round(v * 100) + '%';
        updateVolIcon(v);
    });
    setTimeout(() => {
        document.addEventListener('click', function dismiss(ev) {
            if (!popup.contains(ev.target as Node) && ev.target !== tvEl) {
                popup.remove();
                document.removeEventListener('click', dismiss);
            }
        });
    }, 10);
}
