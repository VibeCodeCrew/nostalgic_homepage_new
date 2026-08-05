// Мост к движку контекстных меню. Движок (features/contextmenu) портируется
// параллельно другим этапом ребилда; контракт: модуль экспортирует
// showContextMenu(x, y, items) с пунктами ContextMenuItem из core/types.
// Через import.meta.glob обращение мягкое: до появления движка — warning, а не падение.

import type { ContextMenuItem } from '../core/types';

type ShowContextMenuFn = (x: number, y: number, items: ContextMenuItem[]) => void;

const loaders = import.meta.glob<{ showContextMenu: ShowContextMenuFn }>('../contextmenu/index.ts');

let cached: ShowContextMenuFn | null = null;
let loading: Promise<ShowContextMenuFn | null> | null = null;

function load(): Promise<ShowContextMenuFn | null> {
    if (cached) return Promise.resolve(cached);
    if (!loading) {
        const loader = loaders['../contextmenu/index.ts'];
        loading = loader
            ? loader().then((m) => { cached = m.showContextMenu; return cached; })
            : Promise.resolve(null);
    }
    return loading;
}

/** Сепаратор меню (в оригинале — строка 'sep' в массиве пунктов). */
export const MENU_SEP: ContextMenuItem = { separator: true };

/** Показать контекстное меню в точке (x, y). */
export function showContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    void load().then((fn) => {
        if (fn) fn(x, y, items);
        else console.warn('[XP] движок контекстных меню ещё не портирован (features/contextmenu)');
    });
}
