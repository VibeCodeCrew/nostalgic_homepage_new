// Глобальные горячие клавиши — порт keydown-блока GLOBAL LISTENERS
// из оригинала (script.js:8427-8444). Лежит рядом с bsod, т.к. это тоже
// «системные» глобальные обработчики, не привязанные к конкретной фиче.

import { runAction, ACTION } from '../../core/actions';
import { activeWindowId } from '../../wm/windowManager';
import { hideContextMenu } from '../contextmenu';
import { closeStartMenu } from '../startmenu';

export function initHotkeys(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') { hideContextMenu(); closeStartMenu(); }
        if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'к')) {
            e.preventDefault();
            runAction(ACTION.openRun);
            return;
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
            e.preventDefault();
            runAction(ACTION.openTaskmgr);
            return;
        }
        // Ctrl/Cmd+V — вставка ярлыка из буфера (в окно папки, если оно активно)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
            const ae = document.activeElement as HTMLElement | null;
            const tag = ae && ae.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable)) return;
            e.preventDefault();
            let folderIdx: number | null = null;
            if (activeWindowId && activeWindowId.startsWith('folder-')) {
                folderIdx = parseInt(activeWindowId.replace('folder-', ''), 10);
            }
            runAction(ACTION.pasteShortcut, { folderIndex: folderIdx });
        }
        // Delete — удалить выделенные ярлыки (с подтверждением при папках)
        if (e.key === 'Delete') {
            const ae = document.activeElement as HTMLElement | null;
            const tag = ae && ae.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable)) return;
            runAction(ACTION.deleteSelected);
        }
    });
}
