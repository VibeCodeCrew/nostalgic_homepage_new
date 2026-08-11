// Движок автогруппировки ярлыков по категориям.
// Чистые функции над in-memory links: данные ярлыков не меняются,
// выключение флага возвращает плоский вид без потерь.

import './grouping.css';
import { KEY_GROUP_STARTMENU, KEY_GROUP_EXPLORER, KEY_GROUP_RULES } from '../../core/keys';
import { getBool, safeParse, setJSON } from '../../core/store';
import { CATEGORIES, CATEGORY_OTHER } from './categories';
import type { LinkItem } from '../../core/types';

export { CATEGORIES, CATEGORY_OTHER };
export type GroupingTarget = 'startmenu' | 'explorer';

export interface GroupRule {
    pattern: string;   // подстрока хоста ('habr' ловит habr.com, habr.ru и т.п.)
    category: string;  // имя категории (свободное, не обязательно из словаря)
}

export function isGroupingEnabled(target: GroupingTarget): boolean {
    return getBool(target === 'startmenu' ? KEY_GROUP_STARTMENU : KEY_GROUP_EXPLORER, false);
}

export function getGroupRules(): GroupRule[] {
    const arr = safeParse<GroupRule[]>(localStorage.getItem(KEY_GROUP_RULES), []);
    return Array.isArray(arr)
        ? arr.filter(r => r && typeof r.pattern === 'string' && typeof r.category === 'string')
        : [];
}

export function saveGroupRules(rules: GroupRule[]): void {
    setJSON(KEY_GROUP_RULES, rules);
}

/** Нормализация хоста: lowercase, без www. */
function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

/** Категория ярлыка по URL. null — не удалось разложить (уйдёт в «Прочее»/плоско). */
export function categorize(url: string | undefined): string | null {
    if (!url) return null;
    const host = hostOf(url);
    if (!host) return null;

    // 1. Пользовательские правила — первое совпадение по подстроке хоста
    for (const rule of getGroupRules()) {
        if (rule.pattern && host.includes(rule.pattern.toLowerCase())) return rule.category;
    }

    // 2. Словарь: самое длинное совпадение доменного суффикса
    let best: string | null = null;
    let bestLen = 0;
    for (const cat of CATEGORIES) {
        for (const d of cat.domains) {
            const dom = d.toLowerCase().replace(/^www\./, '');
            if ((host === dom || host.endsWith('.' + dom)) && dom.length > bestLen) {
                best = cat.name;
                bestLen = dom.length;
            }
        }
    }
    return best;
}

/** Иконка категории (имя png из icons/), неизвестная/пользовательская — folder. */
export function getCategoryIcon(category: string): string {
    const def = CATEGORIES.find(c => c.name === category);
    return def ? def.icon : 'folder';
}

export interface GroupedSingles {
    /** Категория → ярлыки (в порядке словаря/появления) */
    groups: Array<{ category: string; items: LinkItem[] }>;
    /** Неразобранные одиночные ярлыки */
    rest: LinkItem[];
}

/** Раскладывает одиночные ярлыки по категориям (ручные папки сюда не передаём). */
export function groupSingles(singles: LinkItem[]): GroupedSingles {
    const byCat = new Map<string, LinkItem[]>();
    const rest: LinkItem[] = [];
    singles.forEach(item => {
        const cat = categorize(item.url);
        if (cat === null) { rest.push(item); return; }
        const bucket = byCat.get(cat);
        if (bucket) bucket.push(item);
        else byCat.set(cat, [item]);
    });
    // Порядок: сначала категории словаря (в его порядке), затем пользовательские по алфавиту
    const dictOrder = CATEGORIES.map(c => c.name);
    const groups = Array.from(byCat.entries())
        .sort((a, b) => {
            const ia = dictOrder.indexOf(a[0]);
            const ib = dictOrder.indexOf(b[0]);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a[0].localeCompare(b[0], 'ru');
        })
        .map(([category, items]) => ({ category, items }));
    return { groups, rest };
}
