// Мастер первичной настройки (OOBE) в стиле установщика Windows XP —
// порт initSetupOOBE (script.js:8621-8831).
// Шаги: 1) имя + аватар, 2) импорт топ-8 сайтов, 3) тема + режим вида,
// 4) «Запуск браузера» — только яндекс-сборка (нет chrome_url_overrides).
// Синий экран «Завершение установки» → окно мастера (сайдбар, countdown, прогресс).
//
// Сознательные отличия от оригинала (контракты ребилда):
// - userAvatar/username/settings пишутся через core/state (setUserAvatar, setUsername,
//   updateSetting), а не напрямую в localStorage;
// - dataURL-аватар уходит в chrome.storage.local (KEY_AVATAR_CUSTOM) с маркером
//   MARKER_CUSTOM в xp_avatar — семантика повторяет startmenu/avatarPicker.ts;
// - showXPBoot (чёрный экран загрузки XP) и реплика Clippy — зона координатора,
//   здесь только onComplete() + playSound('startup').

import './oobe.css';
import { KEY_SETUP_DONE, KEY_AVATAR_CUSTOM, MARKER_CUSTOM } from '../../core/keys';
import { getStrOrNull, setItem } from '../../core/store';
import { links, saveLinks, userAvatar, setUserAvatar, setUsername, updateSetting } from '../../core/state';
import { el } from '../../core/dom';
import { emit } from '../../core/events';
import { playSound } from '../../core/sound';
import { showXPBoot } from '../bsod';
import type { LinkItem, ThemeId, ViewMode } from '../../core/types';

/** Единый список аватаров для обеих сеток (OOBE и avatar-picker).
 *  Порядок и имена файлов — как в статической разметке оригинала.
 *  «dirt bike.bmp», «palm tree.bmp», «pink flower.bmp», «red flower.bmp» отсутствовали
 *  в avatars/ оригинала — img.onerror скрывает такой пункт сетки (как было задумано). */
export const AVATARS: string[] = [
    'airplane.bmp', 'astronaut.bmp', 'ball.bmp', 'beach.bmp', 'butterfly.bmp', 'car.bmp',
    'cat.bmp', 'chess.bmp', 'dirt bike.bmp', 'dog.bmp', 'drip.bmp', 'duck.bmp',
    'fish.bmp', 'frog.bmp', 'guest.bmp', 'guitar.bmp', 'horses.bmp', 'kick.bmp',
    'lift-off.bmp', 'palm tree.bmp', 'pink flower.bmp', 'red flower.bmp', 'skater.bmp',
    'snowflake.bmp',
];

const DEFAULT_AVATAR = 'avatars/guest.bmp';

/** Генерирует пункты .setup-avatar-item в обеих сетках (#setup-avatar-grid и #ap-avatar-grid).
 *  Идемпотентно: заполненную сетку не трогает. Вызывается из initSetupOOBE
 *  и при открытии avatar-picker (контракт классов/data-src сохранён). */
export function initOOBEGrids(): void {
    ['setup-avatar-grid', 'ap-avatar-grid'].forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (!grid || grid.children.length > 0) return;
        AVATARS.forEach(file => {
            const src = 'avatars/' + file;
            const item = el('div', { className: 'setup-avatar-item', dataset: { src } });
            const img = el('img', { src: src, alt: file.replace(/\.[^.]+$/, '') });
            // Файла может не быть в avatars/ — скрываем пункт сетки целиком
            img.addEventListener('error', () => { item.style.display = 'none'; });
            item.appendChild(img);
            grid.appendChild(item);
        });
    });
}

/** OOBE пройден (xp_setup_done выставлен мастером). */
export function isSetupDone(): boolean {
    return !!getStrOrNull(KEY_SETUP_DONE);
}

/** Сохранение аватара по контракту ребилда (семантика saveAvatar из avatarPicker):
 *  dataURL → chrome.storage.local[KEY_AVATAR_CUSTOM] + маркер 'custom' в xp_avatar,
 *  обычный путь → xp_avatar как есть. */
function saveSetupAvatar(value: string): void {
    if (value.startsWith('data:')) {
        setUserAvatar(MARKER_CUSTOM);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ [KEY_AVATAR_CUSTOM]: value }, () => {
                if (chrome.runtime.lastError) {
                    // Откат: храним dataURL в localStorage, как было в оригинале
                    setUserAvatar(value);
                }
            });
        }
    } else {
        setUserAvatar(value);
    }
}

export function initSetupOOBE(onComplete: () => void): void {
    const overlay = document.getElementById('setup-overlay');
    const blueScreen = document.getElementById('setup-blue-screen');
    const oobeWindow = document.getElementById('setup-oobe-window');

    if (!overlay) {
        onComplete();
        return;
    }

    // Сетки аватаров статической разметки больше нет — генерируем из AVATARS
    initOOBEGrids();

    overlay.classList.remove('hidden');

    let countdownSec = 3 * 60;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    function fmtCountdown(s: number): string { return s >= 60 ? Math.ceil(s / 60) + ' мин.' : s + ' сек.'; }

    setTimeout(() => {
        if (blueScreen) blueScreen.classList.add('hidden');
        if (oobeWindow) oobeWindow.classList.remove('hidden');

        // Countdown
        const cdEl = document.getElementById('setup-countdown');
        if (cdEl) cdEl.textContent = fmtCountdown(countdownSec);
        countdownTimer = setInterval(() => {
            countdownSec = Math.max(0, countdownSec - 5);
            if (cdEl) cdEl.textContent = fmtCountdown(countdownSec);
        }, 5000);

        // Progress bar animation («Сохранение параметров»)
        const progEl = document.getElementById('setup-inst-prog');
        if (progEl) {
            let progVal = 0;
            const progTimer = setInterval(() => {
                progVal = Math.min(progVal + Math.random() * 9 + 1, 95);
                progEl.style.width = progVal + '%';
                if (progVal >= 95) clearInterval(progTimer);
            }, 700);
        }
    }, 3000);

    let currentStep = 1;
    // Яндекс-сборка определяется по отсутствию chrome_url_overrides в манифесте —
    // там добавляем 4-й шаг «Запуск браузера» (копирование адреса для автозапуска)
    const isYandexBuild = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.getManifest
        && !chrome.runtime.getManifest().chrome_url_overrides;
    const totalSteps = isYandexBuild ? 4 : 3;
    if (isYandexBuild) {
        const dot4 = document.getElementById('setup-nav-dot-4');
        if (dot4) dot4.style.display = '';
        const urlInput = document.getElementById('setup-yandex-url') as HTMLInputElement | null;
        const copyBtn = document.getElementById('setup-copy-url-btn');
        const copyMsg = document.getElementById('setup-copy-url-msg');
        const pageUrl = chrome.runtime.getURL('index.html');
        if (urlInput) urlInput.value = pageUrl;
        if (copyBtn) copyBtn.addEventListener('click', () => {
            function onCopied(): void { if (copyMsg) copyMsg.style.display = 'block'; }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(pageUrl).then(onCopied, () => {
                    if (urlInput) { urlInput.select(); document.execCommand('copy'); onCopied(); }
                });
            } else if (urlInput) { urlInput.select(); document.execCommand('copy'); onCopied(); }
        });
    }
    const backBtn = document.getElementById('setup-back-btn') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('setup-next-btn') as HTMLButtonElement | null;
    if (!backBtn || !nextBtn) {
        // Разметка мастера сломана — не блокируем запуск
        overlay.classList.add('hidden');
        setItem(KEY_SETUP_DONE, 'true');
        onComplete();
        return;
    }

    function updateSidebarSteps(): void {
        const elInstall = document.getElementById('oobe-si-install');
        const elFinish  = document.getElementById('oobe-si-finish');
        if (elInstall && elFinish) {
            if (currentStep <= 2) {
                elInstall.className = 'setup-inst-item si-current';
                elFinish.className  = 'setup-inst-item';
            } else {
                elInstall.className = 'setup-inst-item si-done';
                elFinish.className  = 'setup-inst-item si-current';
            }
        }
        const dots = document.querySelectorAll('#setup-nav-dots .setup-nav-dot');
        dots.forEach((dot, i) => { dot.classList.toggle('active', i === currentStep - 1); });
    }

    function updateSteps(): void {
        for (let i = 1; i <= totalSteps; i++) {
            const stepEl = document.getElementById('setup-step-' + i);
            if (stepEl) {
                if (i === currentStep) stepEl.classList.add('active');
                else stepEl.classList.remove('active');
            }
        }
        backBtn!.disabled = (currentStep === 1);
        nextBtn!.textContent = (currentStep === totalSteps) ? 'Готово' : 'Далее >';
        updateSidebarSteps();
    }

    const browserInfo = document.getElementById('setup-browser-info');
    if (browserInfo) {
        let browserName = 'Неизвестный браузер';
        const ua = navigator.userAgent;
        if (ua.indexOf('YaBrowser') > -1) browserName = 'Яндекс.Браузер';
        else if (ua.indexOf('Edg') > -1) browserName = 'Microsoft Edge';
        else if (ua.indexOf('Chrome') > -1) browserName = 'Google Chrome';
        else if (ua.indexOf('Firefox') > -1) browserName = 'Mozilla Firefox';
        browserInfo.textContent = 'Ваш браузер: ' + browserName;
    }

    // ---- Avatar picker ----
    // pendingAvatar — локальный аналог глобального userAvatar оригинала;
    // в core/state пишем только при переходе с шага 1.
    let pendingAvatar: string | null = userAvatar;
    const avatarGrid = document.getElementById('setup-avatar-grid');
    if (avatarGrid) {
        avatarGrid.querySelectorAll<HTMLElement>('.setup-avatar-item').forEach(item => {
            item.setAttribute('role', 'radio');
            item.setAttribute('aria-checked', 'false');
            const srcAttr = item.getAttribute('data-src') || '';
            const name = srcAttr.split('/').pop()!.replace(/\.[^.]+$/, '');
            if (name) item.setAttribute('aria-label', 'Аватар: ' + name);
            item.addEventListener('click', () => {
                avatarGrid.querySelectorAll('.setup-avatar-item').forEach(e => { e.classList.remove('selected'); e.setAttribute('aria-checked', 'false'); });
                item.classList.add('selected');
                item.setAttribute('aria-checked', 'true');
                pendingAvatar = item.getAttribute('data-src');
            });
        });
        // Pre-select current or default (guest)
        const toSelect = userAvatar || DEFAULT_AVATAR;
        const defEl = avatarGrid.querySelector('[data-src="' + toSelect + '"]');
        if (defEl) {
            defEl.classList.add('selected');
            defEl.setAttribute('aria-checked', 'true');
            if (!userAvatar) pendingAvatar = toSelect;
        }
    }
    const uploadInput = document.getElementById('setup-avatar-upload') as HTMLInputElement | null;
    if (uploadInput) {
        uploadInput.addEventListener('change', () => {
            const file = uploadInput.files && uploadInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                pendingAvatar = String(e.target!.result);
                if (avatarGrid) avatarGrid.querySelectorAll('.setup-avatar-item').forEach(item => { item.classList.remove('selected'); });
                const browseBtn = document.getElementById('setup-avatar-browse-btn');
                if (browseBtn) {
                    browseBtn.style.backgroundImage = 'url(' + pendingAvatar + ')';
                    browseBtn.style.backgroundSize = '20px 20px';
                    browseBtn.style.backgroundRepeat = 'no-repeat';
                    browseBtn.style.backgroundPosition = 'left center';
                    browseBtn.style.paddingLeft = '26px';
                }
            };
            reader.readAsDataURL(file);
        });
    }
    // ---- /Avatar picker ----

    const importBtn = document.getElementById('setup-import-btn') as HTMLButtonElement | null;
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.topSites && chrome.topSites.get) {
                chrome.topSites.get(sites => {
                    const top = sites.slice(0, 8);
                    // Если у сайта нет title — дотягиваем заголовок страницы через фоновый
                    // сервис-воркер (fetch_page_title), фолбэк — сам URL (как в оригинале)
                    const items: LinkItem[] = top.map(site => ({ name: site.title || site.url, url: site.url }));
                    let pending = top.length;
                    const finish = (): void => {
                        items.forEach(item => { links.push(item); });
                        saveLinks();
                        const msg = document.getElementById('setup-import-msg');
                        if (msg) msg.style.display = 'block';
                        importBtn.disabled = true;
                    };
                    if (pending === 0) { finish(); return; }
                    top.forEach((site, i) => {
                        const done = (): void => { if (--pending === 0) finish(); };
                        if (site.title || typeof chrome.runtime === 'undefined' || !chrome.runtime.sendMessage) {
                            done();
                            return;
                        }
                        try {
                            chrome.runtime.sendMessage({ action: 'fetch_page_title', url: site.url }, resp => {
                                if (!chrome.runtime.lastError && resp && resp.success && resp.title) {
                                    items[i].name = String(resp.title);
                                }
                                done();
                            });
                        } catch {
                            done();
                        }
                    });
                });
            } else {
                alert('Импорт недоступен. Проверьте разрешения.');
            }
        });
    }

    backBtn.addEventListener('click', () => {
        if (currentStep > 1) { currentStep--; updateSteps(); }
    });

    nextBtn.addEventListener('click', () => {
        if (currentStep === 1) {
            const nameInput = document.getElementById('setup-username-input') as HTMLInputElement | null;
            if (nameInput && nameInput.value.trim()) {
                setUsername(nameInput.value.trim());
            }
            if (pendingAvatar) saveSetupAvatar(pendingAvatar);
        }
        if (currentStep < totalSteps) {
            currentStep++; updateSteps();
        } else {
            const selectedTheme = document.querySelector<HTMLInputElement>('input[name="setup-theme"]:checked');
            if (selectedTheme) updateSetting('theme', selectedTheme.value as ThemeId);
            const selectedView = document.querySelector<HTMLInputElement>('input[name="setup-view"]:checked');
            if (selectedView) updateSetting('viewMode', selectedView.value as ViewMode);
            if (countdownTimer) clearInterval(countdownTimer);
            setItem(KEY_SETUP_DONE, 'true');
            overlay.classList.add('hidden');
            // Чёрный экран загрузки XP, затем инициализация десктопа и jingle
            showXPBoot(() => {
                onComplete();
                playSound('startup'); // синтезированный jingle (файла startup.mp3 в проекте нет — так задумано)
                emit('first-run-completed'); // реакция Clippy (react_first_run) — подписка в features/clippy
            });
        }
    });

    updateSteps();
}
