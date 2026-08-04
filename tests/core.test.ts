// Smoke-тесты core-модулей (node-окружение; window/localStorage стабятся).
import { describe, it, expect, beforeAll } from 'vitest';

// Стабы браузерных глобалов — должны быть установлены ДО импорта модулей,
// поэтому модули подключаются динамически в beforeAll.
function stubGlobals(): void {
    const mem = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
        clear: () => mem.clear(),
        key: (i: number) => [...mem.keys()][i] ?? null,
        get length() { return mem.size; },
    };
    (globalThis as Record<string, unknown>).window = { innerWidth: 1280, innerHeight: 800 };
}

let store: typeof import('../src/core/store');
let grid: typeof import('../src/core/grid');
let dom: typeof import('../src/core/dom');
let url: typeof import('../src/core/url');

beforeAll(async () => {
    stubGlobals();
    store = await import('../src/core/store');
    grid = await import('../src/core/grid');
    dom = await import('../src/core/dom');
    url = await import('../src/core/url');
});

describe('store.safeParse', () => {
    it('возвращает fallback для null/пустой строки', () => {
        expect(store.safeParse(null, [1])).toEqual([1]);
        expect(store.safeParse('', { a: 1 })).toEqual({ a: 1 });
    });
    it('возвращает fallback для битого JSON — не бросает исключение', () => {
        expect(store.safeParse('{бито', [])).toEqual([]);
        expect(store.safeParse('undefined', 42)).toEqual(42);
    });
    it('парсит валидный JSON', () => {
        expect(store.safeParse('[{"name":"x"}]', [])).toEqual([{ name: 'x' }]);
    });
});

describe('grid.snapTo — каноническая сетка', () => {
    it('начало координат — GRID_MARGIN=10', () => {
        expect(grid.snapTo(10, 10, 10)).toEqual({ x: 10, y: 10 });
        // Формула оригинала: смещение margin, поэтому (0,0) привязывается к (0,0)
        expect(grid.snapTo(0, 0, 10)).toEqual({ x: 0, y: 0 });
        expect(grid.snapTo(4, 6, 10)).toEqual({ x: 0, y: 10 });
    });
    it('округляет к ближайшей ячейке', () => {
        expect(grid.snapTo(14, 27, 10)).toEqual({ x: 10, y: 30 });
        expect(grid.snapTo(16, 23, 16)).toEqual({ x: 10, y: 26 });
        expect(grid.snapTo(19, 40, 16)).toEqual({ x: 26, y: 42 });
    });
    it('cell=1 — без привязки', () => {
        expect(grid.snapTo(13, 17, 1)).toEqual({ x: 13, y: 17 });
    });
});

describe('dom.escapeHtml', () => {
    it('экранирует все опасные символы', () => {
        expect(dom.escapeHtml('<img src=x onerror=alert(1)>'))
            .toBe('&lt;img src=x onerror=alert(1)&gt;');
        expect(dom.escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    });
});

describe('url', () => {
    it('isSafeUrl пропускает только http/https', () => {
        expect(url.isSafeUrl('https://ya.ru')).toBe(true);
        expect(url.isSafeUrl('http://example.com/x?y=1')).toBe(true);
        expect(url.isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(url.isSafeUrl('data:text/html,<script>')).toBe(false);
        expect(url.isSafeUrl('file:///etc/passwd')).toBe(false);
        expect(url.isSafeUrl('не url')).toBe(false);
    });
    it('normalizeUrl дописывает https:// голому домену', () => {
        expect(url.normalizeUrl('ya.ru')).toBe('https://ya.ru/');
        expect(url.normalizeUrl('  example.com/path ')).toBe('https://example.com/path');
    });
    it('normalizeUrl отбрасывает опасные схемы', () => {
        expect(url.normalizeUrl('javascript:alert(1)')).toBeNull();
        expect(url.normalizeUrl('')).toBeNull();
    });
    it('looksLikeUrl отличает адрес от запроса', () => {
        expect(url.looksLikeUrl('ya.ru')).toBe(true);
        expect(url.looksLikeUrl('https://ya.ru')).toBe(true);
        expect(url.looksLikeUrl('котики видео')).toBe(false);
    });
});
