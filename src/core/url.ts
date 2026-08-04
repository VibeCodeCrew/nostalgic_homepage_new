// Работа с URL: нормализация и whitelist схем (фикс аудита #4 —
// javascript:/data: URL не должны попадать в window.open из ярлыков и импорта).

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/** Только http/https считаются безопасными для открытия. */
export function isSafeUrl(url: string): boolean {
    try {
        const u = new URL(url);
        return ALLOWED_PROTOCOLS.includes(u.protocol);
    } catch {
        return false;
    }
}

/**
 * Нормализация пользовательского ввода: голый домен получает https://,
 * явные не-http(s) схемы (javascript:, data:, file:...) отбрасываются → null.
 */
export function normalizeUrl(input: string): string | null {
    const raw = (input || '').trim();
    if (!raw) return null;
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const withScheme = hasScheme ? raw : 'https://' + raw;
    try {
        const u = new URL(withScheme);
        if (!ALLOWED_PROTOCOLS.includes(u.protocol)) return null;
        return u.href;
    } catch {
        return null;
    }
}

/** Похоже ли значение на URL (для диалога «Выполнить»/поиска: запрос vs адрес). */
export function looksLikeUrl(input: string): boolean {
    const s = (input || '').trim();
    if (!s || /\s/.test(s)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return true;
    return /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s);
}
