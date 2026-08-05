// «Сведения о системе» / «Об этом Mac» — порт SYSTEM INFO (script.js:4352-4399).

import { el, escapeHtml, xpIconHtml } from '../../core/dom';
import { links, pageLoadTime, settings } from '../../core/state';
import { wmCreate, wmGet, wmResizeToContent, wmWindows, wmRestore, wmFocus } from '../../wm/windowManager';
import { macIcon16 } from '../themes';

export function openSystemInfo(): void {
    if (wmWindows['sysinfo']) { wmRestore('sysinfo'); wmFocus('sysinfo'); return; }
    const mac = settings.theme === 'macos';
    const up = Math.floor((Date.now() - pageLoadTime) / 1000);
    const manifest = chrome.runtime.getManifest();
    const c = el('div', { className: 'sysinfo-window' });
    // Логотип темы: в macos — яблоко из набора Cheetah, в XP — «Мой компьютер»
    const headIcon = mac
        ? '<img src="icons/mac/apple.png" width="44" height="44" alt="">'
        : '<img src="icons/48/my-computer.png" width="48" height="48" alt="">';
    const sysLine = mac
        ? '<b>Система:</b> Mac OS X, версия 10.0 «Cheetah»'
        : '<b>Система:</b> Microsoft Windows XP Professional, Version 2002';
    // В пакете оба набора иконок — кредиты показываем независимо от темы
    const iconsCredit =
        '<div class="sysinfo-row">Иконки: <a href="https://github.com/marchmountain/-Windows-XP-High-Resolution-Icon-Pack" target="_blank" style="color:#0033cc;">Windows XP High Resolution Icon Pack</a> by marchmountain (CC0 1.0) и <a href="https://github.com/B00merang-Project/Mac-OS-X-Cheetah" target="_blank" style="color:#0033cc;">Mac-X-Cheetah</a> by Elbullazul (GPL-3.0, текст — icons/mac/LICENSE.md).</div>' +
        (mac
            ? '<div class="sysinfo-row">Mac OS X — торговая марка Apple Inc.</div>'
            : '<div class="sysinfo-row">Windows XP — торговая марка Microsoft Corporation.</div>');
    c.innerHTML = '<div class="sysinfo-head">' +
        headIcon +
        '<div>' +
        '<div class="sysinfo-title">' + escapeHtml(manifest.name) + '</div>' +
        '<div class="sysinfo-edition">Версия ' + escapeHtml(manifest.version) + '</div>' +
        '<div class="sysinfo-edition">© 2026 VibeCodeCrew</div>' +
        '</div></div>' +
        '<hr class="sysinfo-hr">' +
        '<div class="sysinfo-row">' + sysLine + '</div>' +
        '<div class="sysinfo-row"><b>Браузер:</b> ' + escapeHtml(navigator.userAgent.substring(0, 120)) + '</div>' +
        '<div class="sysinfo-row"><b>Разрешение:</b> ' + screen.width + '×' + screen.height + '</div>' +
        '<div class="sysinfo-row"><b>Окно:</b> ' + window.innerWidth + '×' + window.innerHeight + '</div>' +
        '<div class="sysinfo-row"><b>Аптайм страницы:</b> ' + Math.floor(up / 3600) + 'ч ' + Math.floor((up % 3600) / 60) + 'м ' + (up % 60) + 'с</div>' +
        '<div class="sysinfo-row"><b>Ярлыков:</b> ' + links.length + '</div>' +
        '<hr class="sysinfo-hr">' +
        '<div class="sysinfo-section-title">Лицензия и авторство</div>' +
        '<div class="sysinfo-row">Код аддона распространяется под лицензией MIT.</div>' +
        iconsCredit +
        '<div class="sysinfo-row" style="margin-top:4px;"><a href="https://github.com/VibeCodeCrew/windows_xp_homepage" target="_blank" style="color:#0033cc;">github.com/VibeCodeCrew/windows_xp_homepage</a></div>';
    wmCreate('sysinfo', mac ? 'Об этом Mac' : 'Свойства системы', c, 480, 290, mac ? macIcon16('harddisk') : xpIconHtml('my-computer', 16));
    setTimeout(() => {
        const win = wmGet('sysinfo')?.el;
        if (!win) return;
        const content = win.querySelector<HTMLElement>('.xp-win-content');
        if (!content) return;
        wmResizeToContent('sysinfo', content.scrollWidth, content.scrollHeight, 480, 290, 640, Math.max(290, window.innerHeight - 100));
    }, 0);
}
