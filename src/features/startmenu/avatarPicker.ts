// Диалог выбора аватара пользователя — порт openAvatarPicker (script.js:3215-3291).
// ФИКС АУДИТА #3: пользовательский (загруженный) аватар хранится в chrome.storage.local,
// а не в localStorage (dataURL мог переполнить квоту). В xp_avatar тогда маркер 'custom'.

import { userAvatar, setUserAvatar } from '../../core/state';
import { KEY_AVATAR_CUSTOM, MARKER_CUSTOM, STORAGE } from '../../core/keys';
import { readMigratedBlob } from '../../core/screenshots';

const DEFAULT_AVATAR = 'avatars/guest.bmp';

/** Разрешает актуальный src аватара (обычный путь или custom из chrome.storage.local). */
export function resolveAvatarSrc(cb: (src: string) => void): void {
    if (userAvatar === MARKER_CUSTOM) {
        readMigratedBlob(KEY_AVATAR_CUSTOM, data => cb(data || DEFAULT_AVATAR));
    } else {
        cb(userAvatar || DEFAULT_AVATAR);
    }
}

/** Сохраняет выбранный аватар: dataURL уходит в chrome.storage.local, пути — в localStorage. */
function saveAvatar(value: string, onSaved: (src: string) => void): void {
    if (value.startsWith('data:')) {
        setUserAvatar(MARKER_CUSTOM);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ [KEY_AVATAR_CUSTOM]: value }, () => {
                if (chrome.runtime.lastError) {
                    // Откат: попробуем хранить в localStorage как раньше
                    setUserAvatar(value);
                }
                onSaved(value);
            });
        } else {
            onSaved(value);
        }
    } else {
        setUserAvatar(value);
        onSaved(value);
    }
}

export function openAvatarPicker(): void {
    const overlayEl = document.getElementById('avatar-picker-overlay');
    if (!overlayEl) return;
    const overlay = overlayEl;
    const grid = document.getElementById('ap-avatar-grid');
    let pendingAvatar: string | null = userAvatar;

    // Предвыбор текущего аватара
    if (grid) {
        grid.querySelectorAll('.setup-avatar-item').forEach(node => {
            node.classList.remove('selected');
            if (node.getAttribute('data-src') === userAvatar) node.classList.add('selected');
        });
        // Пользовательский (base64) аватар — ничего в сетке не выбрано, это нормально
        if (!userAvatar) {
            const def = grid.querySelector('[data-src="avatars/guest.bmp"]');
            if (def) { def.classList.add('selected'); pendingAvatar = DEFAULT_AVATAR; }
        }
        // Перепривязка чистых обработчиков при каждом открытии
        grid.querySelectorAll('.setup-avatar-item').forEach(node => {
            const clone = node.cloneNode(true);
            node.parentNode!.replaceChild(clone, node);
        });
        grid.querySelectorAll('.setup-avatar-item').forEach(node => {
            const item = node as HTMLElement;
            item.setAttribute('role', 'radio');
            item.setAttribute('aria-checked', item.classList.contains('selected') ? 'true' : 'false');
            const srcAttr = item.getAttribute('data-src') || '';
            const name = srcAttr.split('/').pop()!.replace(/\.[^.]+$/, '');
            if (name) item.setAttribute('aria-label', 'Аватар: ' + name);
            item.addEventListener('click', () => {
                grid.querySelectorAll('.setup-avatar-item').forEach(e => { e.classList.remove('selected'); e.setAttribute('aria-checked', 'false'); });
                item.classList.add('selected');
                item.setAttribute('aria-checked', 'true');
                pendingAvatar = item.getAttribute('data-src');
            });
        });
    }

    // Загрузка своего файла
    const uploadInput = document.getElementById('ap-avatar-upload') as HTMLInputElement | null;
    if (uploadInput) {
        const uploadClone = uploadInput.cloneNode(true) as HTMLInputElement;
        uploadInput.parentNode!.replaceChild(uploadClone, uploadInput);
        uploadClone.addEventListener('change', () => {
            const file = uploadClone.files && uploadClone.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                pendingAvatar = String(e.target!.result);
                if (grid) grid.querySelectorAll('.setup-avatar-item').forEach(node => node.classList.remove('selected'));
            };
            reader.readAsDataURL(file);
        });
    }

    function applyAndClose(): void {
        if (pendingAvatar) {
            saveAvatar(pendingAvatar, src => {
                const smImg = document.getElementById('sm-avatar-img') as HTMLImageElement | null;
                if (smImg) smImg.src = src;
            });
        }
        overlay.classList.add('hidden');
    }
    function cancelAndClose(): void { overlay.classList.add('hidden'); }

    // Привязка кнопок (пересоздание, чтобы не копились слушатели)
    function rewire(id: string, fn: () => void): void {
        const node = document.getElementById(id);
        if (!node) return;
        const c = node.cloneNode(true);
        node.parentNode!.replaceChild(c, node);
        c.addEventListener('click', fn);
    }
    rewire('ap-ok-btn', applyAndClose);
    rewire('ap-cancel-btn', cancelAndClose);
    rewire('avatar-picker-close', cancelAndClose);

    overlay.classList.remove('hidden');
}
