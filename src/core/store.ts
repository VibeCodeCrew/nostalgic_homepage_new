// Типизированный слой над localStorage: безопасный парсинг и запись с защитой от квоты.

import { emit } from './events';

/** Безопасный JSON.parse: битые данные не роняют приложение (фикс критичной находки аудита). */
export function safeParse<T>(raw: string | null, fallback: T): T {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : (parsed as T);
    } catch {
        console.warn('[XP] битый JSON в хранилище, используется значение по умолчанию');
        return fallback;
    }
}

export function getStr(key: string, fallback: string): string {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
}

export function getStrOrNull(key: string): string | null {
    return localStorage.getItem(key);
}

export function getInt(key: string, fallback: number): number {
    const v = parseInt(localStorage.getItem(key) || '', 10);
    return isNaN(v) ? fallback : v;
}

export function getFloat(key: string, fallback: number): number {
    const v = parseFloat(localStorage.getItem(key) || '');
    return isNaN(v) ? fallback : v;
}

/** Булевы ключи в оригинале хранятся строками 'true'/'false'; отсутствие ключа = fallback. */
export function getBool(key: string, fallback: boolean): boolean {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
}

/**
 * Запись в localStorage с защитой от QuotaExceededError (фикс аудита):
 * при переполнении не роняем приложение, а шлём событие — UI покажет уведомление.
 * Возвращает true при успехе.
 */
export function setItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error('[XP] не удалось записать в localStorage: ' + key, e);
        emit('storage-quota', { key });
        return false;
    }
}

export function removeItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch { /* ignore */ }
}

export function setJSON(key: string, value: unknown): boolean {
    return setItem(key, JSON.stringify(value));
}
