// Проводники: Мой компьютер, Мои ярлыки (C:), Закладки (D:), Корзина, Сведения.

import './explorer.css';
import { registerAction, ACTION } from '../../core/actions';
import { openLinksExplorer } from './linksExplorer';
import { openMyComputer } from './myComputer';
import { openBrowserBookmarks } from './bookmarks';
import { openRecycleBin } from './recycleBin';
import { openSystemInfo } from './systemInfo';

export { openLinksExplorer, openMyComputer, openBrowserBookmarks, openRecycleBin, openSystemInfo };

export function initExplorer(): void {
    registerAction(ACTION.openLinksExplorer, openLinksExplorer);
    registerAction(ACTION.openMyComputer, openMyComputer);
    registerAction('open-bookmarks', openBrowserBookmarks);
    registerAction(ACTION.openRecycle, openRecycleBin);
    registerAction(ACTION.openSysInfo, openSystemInfo);
    // «О программе» в меню Пуск ведёт туда же, что и «Сведения»
    registerAction(ACTION.openAbout, openSystemInfo);
}
