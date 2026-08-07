// Мини event-bus: фичи общаются через события, а не через глобальные переменные.

import type { Settings, ThemeId } from './types';

export interface EventMap {
    'links-changed': undefined;
    'trash-changed': undefined;
    'settings-changed': { key: keyof Settings };
    'theme-changed': { theme: ThemeId };
    'selection-changed': undefined;
    'wm-changed': undefined;           // список окон изменился (открытие/закрытие/минимизация)
    'wm-opened': { id: string; title: string };
    'wm-closed': { id: string };
    'wm-dup-open': { id: string };     // повторное открытие уже запущенного приложения
    'storage-quota': { key: string };  // не удалось записать в localStorage (переполнение)
    'user-changed': undefined;         // имя/аватар пользователя изменились
    'desktop-rendered': undefined;     // рабочий стол перерисован (renderDesktop)
    // --- Триггеры реакций Скрепки (эмиттеры добавляет координатор; подписчик — features/clippy) ---
    'calendar-opened': undefined;      // открыт календарь (клик по часам)
    'volume-changed': undefined;       // громкость изменена (слайдер отпущен)
    'data-exported': undefined;        // данные экспортированы в JSON
    'wallpaper-changed': undefined;    // установлен пользовательский фон рабочего стола
    'startmenu-opened': undefined;     // открыто меню Пуск
    'screenshot-taken': undefined;     // скриншот ярлыка успешно обновлён
    'first-run-completed': undefined;  // завершён первый запуск (setup-мастер)
    'bsod-ended': undefined;           // BSOD закрыт, началась загрузка XP
    'update-available': undefined;     // найдена новая версия (Windows Update)
}

type Handler<T> = (payload: T) => void;

const handlers = new Map<string, Set<Handler<unknown>>>();

export function on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    let set = handlers.get(event);
    if (!set) {
        set = new Set();
        handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => off(event, handler);
}

export function off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    handlers.get(event)?.delete(handler as Handler<unknown>);
}

export function emit<K extends keyof EventMap>(event: K, ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]): void {
    const payload = args[0];
    handlers.get(event)?.forEach(h => {
        try {
            h(payload);
        } catch (e) {
            console.error('[XP] ошибка обработчика события ' + event, e);
        }
    });
}
