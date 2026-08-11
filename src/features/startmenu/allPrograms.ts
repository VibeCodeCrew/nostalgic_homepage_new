// «Все программы» — каскадный флаиут вправо, как в настоящем Windows XP
// (заменяет прежний оверлей-аккордеон). Движок — features/contextmenu
// (вложенные submenu с hover-раскрытием), стилизация — класс sm-cascade.

import { xpIconHtml, getFaviconUrl } from '../../core/dom';
import { links } from '../../core/state';
import { runAction, ACTION } from '../../core/actions';
import { showContextMenu } from '../contextmenu';
import { openLinkItem } from '../desktop';
import { isGroupingEnabled, groupSingles, getCategoryIcon } from '../grouping';
import type { ContextMenuItem, LinkItem } from '../../core/types';

// Закрыть меню Пуск перед запуском пункта (импорт цикла нет — startmenu
// вызывает каскад, но каскад не знает о startmenu: используем событийный клик).
let onBeforeRun: (() => void) | null = null;

/** startmenu передаёт сюда closeStartMenu — вызывается перед запуском пункта. */
export function setCascadeCloser(fn: () => void): void {
    onBeforeRun = fn;
}

function run(fn: () => void): () => void {
    return () => {
        if (onBeforeRun) onBeforeRun();
        fn();
    };
}

function appItem(label: string, icon: string, actionName: string): ContextMenuItem {
    return { label: label, icon: xpIconHtml(icon, 16), action: run(() => { runAction(actionName); }) };
}

function linkItem(item: LinkItem): ContextMenuItem {
    const fav = item.customIcon || getFaviconUrl(item.url || '');
    if (fav) {
        const img = document.createElement('img');
        img.className = 'sm-cascade-favicon';
        img.src = fav;
        img.width = 16;
        img.height = 16;
        img.alt = '';
        img.onerror = () => { img.style.visibility = 'hidden'; };
        return { label: item.name, iconEl: img, action: run(() => { openLinkItem(item); }) };
    }
    return { label: item.name, icon: xpIconHtml('document', 16), action: run(() => { openLinkItem(item); }) };
}

/** Дерево «Все программы»: Стандартные ▸, Игры ▸, папки рабочего стола ▸, одиночные ярлыки.
 *  При включённой автогруппировке одиночные ярлыки раскладываются по категориям ▸;
 *  группа с именем ручной папки сливается с ней (авто-ярлыки дописываются после разделителя). */
export function buildAllProgramsTree(): ContextMenuItem[] {
    const games: ContextMenuItem = {
        label: 'Игры',
        icon: xpIconHtml('hearts', 16),
        submenu: [
            appItem('Сапёр', 'minesweeper', 'app:minesweeper'),
            appItem('Косынка', 'solitaire', 'app:solitaire'),
            appItem('Червы', 'hearts', 'app:hearts'),
            appItem('Пинбол', 'pinball', ACTION.openPinball),
            appItem('DOOM', 'doom', ACTION.openDoom),
        ],
    };
    const accessories: ContextMenuItem = {
        label: 'Стандартные',
        icon: xpIconHtml('folder', 16),
        submenu: [
            appItem('Блокнот', 'notepad', 'app:notepad'),
            appItem('WordPad', 'wordpad', 'app:wordpad'),
            appItem('Paint', 'paint', 'app:paint'),
            appItem('Калькулятор', 'calculator', 'app:calculator'),
            appItem('Командная строка', 'cmd', 'app:cmd'),
            appItem('Диспетчер задач', 'taskmgr', ACTION.openTaskmgr),
        ],
    };

    const tree: ContextMenuItem[] = [accessories, games];

    const manualFolders = links.filter(i => i.isFolder && i.items && i.items.length);
    const singles = links.filter(i => !i.isFolder);

    // Автогруппировка (если включена): категория → авто-ярлыки;
    // совпадающая с ручной папкой категория сливается в неё
    const mergedIntoFolder = new Map<string, LinkItem[]>();
    let autoGroups: Array<{ category: string; items: LinkItem[] }> = [];
    let rest = singles;
    if (isGroupingEnabled('startmenu')) {
        const g = groupSingles(singles);
        const folderNames = new Set(manualFolders.map(f => f.name));
        g.groups.forEach(gr => {
            if (folderNames.has(gr.category)) mergedIntoFolder.set(gr.category, gr.items);
            else autoGroups.push(gr);
        });
        rest = g.rest;
    }

    // Папки рабочего стола — каскадом с содержимым (+ слитые автогруппы)
    manualFolders.forEach(folder => {
        const submenu: ContextMenuItem[] = folder.items!.map(linkItem);
        const merged = mergedIntoFolder.get(folder.name);
        if (merged && merged.length) {
            submenu.push({ separator: true });
            merged.forEach(i => submenu.push(linkItem(i)));
        }
        tree.push({
            label: folder.name,
            icon: xpIconHtml('folder', 16),
            submenu: submenu,
        });
    });

    // Автогруппы категорий (иконка категории)
    autoGroups.forEach(gr => {
        tree.push({
            label: gr.category,
            icon: xpIconHtml(getCategoryIcon(gr.category), 16),
            submenu: gr.items.map(linkItem),
        });
    });

    // Неразобранные одиночные ярлыки — плоско, как раньше
    if (rest.length) {
        tree.push({ separator: true });
        rest.forEach(i => { tree.push(linkItem(i)); });
    }

    return tree;
}

/** Показать каскад «Все программы» справа от кнопки (hover/клик по ней). */
export function openAllProgramsCascade(anchorBtn: HTMLElement): void {
    const r = anchorBtn.getBoundingClientRect();
    // XP открывает флаиут у правого края меню, по верху кнопки;
    // движок сам удержит панель в вьюпорте
    showContextMenu(r.right - 2, r.top, buildAllProgramsTree(), 'sm-cascade');
}
