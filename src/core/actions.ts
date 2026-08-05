// Командный реестр: точки расширения для межфичевых вызовов без жёстких импортов.
// Например, меню Пуск вызывает runAction('app:notepad'), не зная о модуле приложения —
// приложение регистрирует обработчик при инициализации.

type ActionHandler<P = unknown> = (payload?: P) => void;

const actions = new Map<string, ActionHandler<never>>();

export function registerAction<P = unknown>(name: string, handler: ActionHandler<P>): void {
    actions.set(name, handler as ActionHandler<never>);
}

export function runAction<P = unknown>(name: string, payload?: P): void {
    const handler = actions.get(name);
    if (handler) {
        (handler as ActionHandler<P>)(payload);
    } else {
        console.warn('[XP] действие не зарегистрировано: ' + name);
    }
}

// Стандартные имена действий (чтобы не разъезжались строки по коду).
export const ACTION = {
    addShortcut: 'add-shortcut',
    addFolder: 'add-folder',
    editShortcut: 'edit-shortcut',       // payload: { index, childIndex? }
    pasteShortcut: 'paste-shortcut',     // payload: { folderIndex: number | null }
    refreshScreenshot: 'refresh-screenshot', // payload: { url, item }
    openSettings: 'open-settings',
    openDisplayProperties: 'open-display-properties',
    openRun: 'open-run',
    openTaskmgr: 'open-taskmgr',
    openMyComputer: 'open-mycomputer',
    openRecycle: 'open-recycle',
    openSysInfo: 'open-sysinfo',
    openLinksExplorer: 'open-links-explorer',
    openAbout: 'open-about',
    importData: 'import-data',
    exportData: 'export-data',
    checkUpdates: 'check-updates',
    openSearch: 'open-search',
    newSticky: 'new-sticky',
    shutdown: 'shutdown',
    openDoom: 'app:doom',
    openPinball: 'app:pinball',
    startScreensaver: 'screensaver',
} as const;
