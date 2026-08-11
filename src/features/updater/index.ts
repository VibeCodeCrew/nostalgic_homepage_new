// Проверка обновлений расширения: последний релиз на GitHub (releases API
// репозитория nostalgic_homepage_new), сравнение версий, диалог ручной
// установки через chrome.downloads. Индикатор в трее и меню-баре macos —
// через features/tray/updateBell (setUpdateAvailable).

import { escapeHtml, xpIconHtml } from '../../core/dom';
import { emit } from '../../core/events';
import { showNotification } from '../../core/notifications';
import { registerAction, ACTION } from '../../core/actions';
import { wmGet, wmCreate, wmRestore, wmFocus, wmClose, wmResizeToContent } from '../../wm/windowManager';
import { setUpdateAvailable, type UpdateInfo } from '../tray/updateBell';

// Последний релиз нового репозитория — источник обновлений
const _UPD_API = 'https://api.github.com/repos/VibeCodeCrew/nostalgic_homepage_new/releases/latest';
const _UPD_PAGE = 'https://github.com/VibeCodeCrew/nostalgic_homepage_new/releases/latest';

// { current, remote }, когда найдено обновление. Держим локальную копию
// (параллельно updateBell) для мока в тестах — см. getter/setter ниже.
let _updateAvail: UpdateInfo | null = null;
// URL ZIP-ассета последнего релиза (для кнопки «Скачать»)
let _updateZipUrl: string | null = null;

export function getUpdateAvail(): UpdateInfo | null {
    return _updateAvail;
}

/** Установить флаг обновления извне (мок в тестах) — синхронно с индикатором в трее. */
export function setUpdateAvail(info: UpdateInfo | null): void {
    _updateAvail = info;
    setUpdateAvailable(info);
}

/** a > b для версий вида "1.2.3" (числовое сравнение сегментов). */
function _verGt(a: string, b: string): boolean {
    const av = String(a).split('.').map(Number);
    const bv = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
        const d = (av[i] || 0) - (bv[i] || 0);
        if (d > 0) return true;
        if (d < 0) return false;
    }
    return false;
}

/** Версия установленного расширения; вне среды расширения (dev/тесты) — '0.0.0'. */
function localVersion(): string {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        return chrome.runtime.getManifest().version;
    }
    return '0.0.0';
}

interface GhRelease {
    tag_name?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
}

export async function checkForUpdates(silent: boolean): Promise<void> {
    try {
        const resp = await fetch(_UPD_API + '?_nc=' + Date.now(), {
            headers: { 'Accept': 'application/vnd.github+json' },
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const release = await resp.json() as GhRelease;
        // Версия из тега релиза ('v2.5.1' → '2.5.1')
        const remoteVer = (release.tag_name || '').replace(/^v/i, '');
        const local = localVersion();
        if (remoteVer && _verGt(remoteVer, local)) {
            const zipAsset = (release.assets || []).find(a => a.name && a.name.endsWith('.zip') && a.browser_download_url);
            _updateZipUrl = zipAsset ? zipAsset.browser_download_url! : null;
            setUpdateAvail({ current: local, remote: remoteVer });
            emit('update-available');
            if (silent) {
                showNotification('Windows Update', 'Доступна версия ' + remoteVer + ' (сейчас ' + local + ')', xpIconHtml('update', 16), 7000);
            } else {
                openUpdateDialog(local, remoteVer);
            }
        } else {
            setUpdateAvail(null);
            if (!silent) {
                showNotification('Windows Update', 'Установлена последняя версия (' + local + ')', '✅', 4000);
            }
        }
    } catch (e) {
        if (!silent) showNotification('Windows Update', 'Ошибка проверки: ' + (e as Error).message, '⚠️', 5000);
    }
}

export function openUpdateDialog(currentVer: string, newVer: string): void {
    if (wmGet('updater')) { wmRestore('updater'); wmFocus('updater'); return; }

    const c = document.createElement('div');
    c.style.cssText = 'display:flex;flex-direction:column;height:100%;font-family:Tahoma,sans-serif;font-size:11px;background:#fff;';

    // Синяя шапка как в Windows Update
    const hdr = document.createElement('div');
    hdr.style.cssText = 'background:linear-gradient(90deg,#0050cc 0%,#1874e8 55%,#00aaff 100%);padding:12px 16px;display:flex;align-items:center;gap:14px;flex-shrink:0;';
    hdr.innerHTML =
        '<svg width="36" height="36" viewBox="0 0 36 36"><rect x="0" y="0" width="16" height="16" fill="#f35325"/><rect x="20" y="0" width="16" height="16" fill="#81bc06"/><rect x="0" y="20" width="16" height="16" fill="#05a6f0"/><rect x="20" y="20" width="16" height="16" fill="#ffba08"/></svg>' +
        '<div>' +
          '<div style="color:#fff;font-size:14px;font-weight:bold;font-family:\'Franklin Gothic Medium\',Tahoma,sans-serif;">Windows Update</div>' +
          '<div style="color:#b8d8ff;font-size:11px;margin-top:2px;">Доступна новая версия Nostalgic Startpage</div>' +
        '</div>';
    c.appendChild(hdr);

    // Белая полоска-разделитель (желтая как в XP update)
    const strip = document.createElement('div');
    strip.style.cssText = 'background:#fff8c0;border-top:1px solid #e0c040;border-bottom:1px solid #e0c040;padding:5px 16px;font-size:11px;color:#604000;flex-shrink:0;';
    strip.innerHTML = '⚠️ &nbsp;Для завершения установки потребуется перезагрузить расширение вручную.';
    c.appendChild(strip);

    // Тело
    const body = document.createElement('div');
    body.className = 'updater-body';
    body.style.cssText = 'flex:1;padding:14px 16px;overflow-y:auto;';
    body.innerHTML =
        '<table style="border-collapse:collapse;width:100%;margin-bottom:12px;">' +
          '<tr><td style="padding:3px 8px 3px 0;color:#666;white-space:nowrap;">Установленная версия:</td>' +
              '<td style="padding:3px 0;font-weight:bold;">' + escapeHtml(String(currentVer)) + '</td></tr>' +
          '<tr><td style="padding:3px 8px 3px 0;color:#666;white-space:nowrap;">Доступная версия:</td>' +
              '<td style="padding:3px 0;font-weight:bold;color:#0050cc;">' + escapeHtml(String(newVer)) + '</td></tr>' +
        '</table>' +
        '<div style="background:#eef4ff;border:1px solid #90b8f0;border-radius:2px;padding:10px 12px;">' +
          '<b style="display:block;margin-bottom:6px;">Как установить обновление:</b>' +
          '<ol style="margin:0;padding-left:18px;line-height:1.8;">' +
            '<li>Нажмите <b>«Скачать»</b> — загрузится ZIP-архив</li>' +
            '<li>Распакуйте архив <b>поверх</b> папки расширения</li>' +
            '<li>Откройте <b style="font-family:monospace;">chrome://extensions</b></li>' +
            '<li>Нажмите кнопку 🔄 «Обновить» рядом с расширением</li>' +
          '</ol>' +
        '</div>';
    c.appendChild(body);

    // Кнопки
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;padding:8px 12px;background:#ECE9D8;border-top:1px solid #aca899;flex-shrink:0;';
    const dlBtn = document.createElement('button'); dlBtn.className = 'xp-dialog-btn xp-dialog-btn-primary';
    dlBtn.textContent = '⬇️ Скачать обновление';
    const laterBtn = document.createElement('button'); laterBtn.className = 'xp-dialog-btn';
    laterBtn.textContent = 'Позже';
    const extBtn = document.createElement('button'); extBtn.className = 'xp-dialog-btn';
    extBtn.textContent = '🔧 chrome://extensions';
    btns.appendChild(dlBtn); btns.appendChild(extBtn); btns.appendChild(laterBtn);
    c.appendChild(btns);

    wmCreate('updater', 'Windows Update', c, 420, 320, xpIconHtml('update', 16));
    setTimeout(() => {
        const bodyEl = c.querySelector<HTMLElement>('.updater-body');
        if (bodyEl) {
            const desiredH = bodyEl.scrollHeight + 28; // учитываем вертикальные отступы
            wmResizeToContent('updater', null, desiredH, 400, 280, 640, 600);
        }
    }, 0);

    dlBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.downloads) {
            if (_updateZipUrl) {
                chrome.downloads.download({ url: _updateZipUrl, filename: 'nostalgic-startpage-update.zip' });
            } else {
                // Нет ZIP-ассета в релизе — открываем страницу релиза
                chrome.tabs.create({ url: _UPD_PAGE });
            }
        }
        dlBtn.textContent = '✅ Загружается...'; dlBtn.disabled = true;
        showNotification('Windows Update', 'Загрузка начата. После завершения распакуйте поверх папки расширения.', '⬇️', 7000);
    });
    extBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: 'chrome://extensions' });
        }
    });
    laterBtn.addEventListener('click', () => { wmClose('updater'); });
}

export function initUpdater(): void {
    registerAction(ACTION.checkUpdates, () => {
        // Если обновление уже найдено — диалог сразу, без повторного fetch (как клик по колокольчику в оригинале)
        const avail = getUpdateAvail();
        if (avail) { openUpdateDialog(avail.current, avail.remote); return; }
        void checkForUpdates(false);
    });
    // Проверка обновлений при старте (тихая) и раз в 2 часа (порт script.js:8541-8542)
    setTimeout(() => { void checkForUpdates(true); }, 5000);
    setInterval(() => { void checkForUpdates(true); }, 2 * 60 * 60 * 1000);
}
