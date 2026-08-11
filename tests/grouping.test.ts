// Тесты движка автогруппировки (features/grouping).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

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

let grouping: typeof import('../src/features/grouping');

beforeAll(async () => {
    stubGlobals();
    grouping = await import('../src/features/grouping');
});

beforeEach(() => {
    localStorage.clear();
});

describe('categorize', () => {
    it('раскладывает по словарю', () => {
        expect(grouping.categorize('https://youtube.com/watch?v=1')).toBe('Видео');
        expect(grouping.categorize('https://ozon.ru/product/123')).toBe('Покупки');
        expect(grouping.categorize('https://github.com/user/repo')).toBe('Разработка');
        expect(grouping.categorize('https://vk.com/feed')).toBe('Соцсети');
    });
    it('понимает поддомены и www', () => {
        expect(grouping.categorize('https://music.yandex.ru/home')).toBe('Музыка');
        expect(grouping.categorize('https://www.youtube.com/')).toBe('Видео');
        expect(grouping.categorize('https://store.steampowered.com/app/1')).toBe('Игры');
    });
    it('неизвестный хост → null', () => {
        expect(grouping.categorize('https://some-random-site-xyz.example')).toBeNull();
        expect(grouping.categorize('не url')).toBeNull();
        expect(grouping.categorize(undefined)).toBeNull();
    });
    it('пользовательское правило важнее словаря', () => {
        grouping.saveGroupRules([{ pattern: 'youtube', category: 'Работа' }]);
        expect(grouping.categorize('https://youtube.com/')).toBe('Работа');
    });
    it('пользовательское правило по подстроке хоста', () => {
        grouping.saveGroupRules([{ pattern: 'habr', category: 'Разработка' }]);
        expect(grouping.categorize('https://habr.com/ru/articles/1')).toBe('Разработка');
    });
});

describe('groupSingles', () => {
    it('группирует в порядке словаря, неразобранные — в rest', () => {
        const links = [
            { name: 'GH', url: 'https://github.com' },
            { name: 'YT', url: 'https://youtube.com' },
            { name: '???', url: 'https://unknown-site-qqq.example' },
        ];
        const g = grouping.groupSingles(links);
        expect(g.groups.map(x => x.category)).toEqual(['Видео', 'Разработка']); // Видео раньше в словаре
        expect(g.rest).toHaveLength(1);
        expect(g.rest[0].name).toBe('???');
    });
});

describe('isGroupingEnabled', () => {
    it('по умолчанию выключено, читается из ключей', () => {
        expect(grouping.isGroupingEnabled('startmenu')).toBe(false);
        expect(grouping.isGroupingEnabled('explorer')).toBe(false);
        localStorage.setItem('edge_group_startmenu', 'true');
        expect(grouping.isGroupingEnabled('startmenu')).toBe(true);
        expect(grouping.isGroupingEnabled('explorer')).toBe(false);
    });
});
