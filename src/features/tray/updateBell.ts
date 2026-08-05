// Колокольчик обновлений в трее (+ зеркало #mb-update в меню-баре macos).
// Updater — отдельный этап ребилда; он сообщает о наличии обновления через
// setUpdateAvailable(info). Клик по индикатору — проверка обновлений через
// командный реестр (ACTION.checkUpdates).

import { runAction, ACTION } from '../../core/actions';

export interface UpdateInfo {
    current: string;  // установленная версия
    remote: string;   // доступная версия
}

let updateAvailable: UpdateInfo | null = null;

export function getUpdateAvailable(): UpdateInfo | null {
    return updateAvailable;
}

/** Показать/скрыть индикатор обновления (трей + меню-бар macos, если он есть). */
export function setUpdateAvailable(info: UpdateInfo | null): void {
    updateAvailable = info;
    const trayUpd = document.getElementById('tray-update');
    if (trayUpd) trayUpd.classList.toggle('hidden', !info);
    const mbUpd = document.getElementById('mb-update'); // зеркало в меню-баре (тема macos)
    if (mbUpd) mbUpd.classList.toggle('hidden', !info);
}

/** Биндинг клика по #tray-update. */
export function initUpdateBell(): void {
    const trayUpd = document.getElementById('tray-update');
    if (trayUpd) trayUpd.addEventListener('click', (e) => {
        e.stopPropagation();
        runAction(ACTION.checkUpdates);
    });
}
