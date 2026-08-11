// Редактор пользовательских правил группировки — окно «Категории ярлыков».

import './grouping.css';
import { el, escapeHtml, xpIconHtml } from '../../core/dom';import { wmCreate, wmGet, wmRestore, wmFocus } from '../../wm/windowManager';
import { CATEGORIES, getGroupRules, saveGroupRules, GroupRule } from './index';

const WIN_ID = 'group-rules';

export function openGroupRulesDialog(): void {
    if (wmGet(WIN_ID)) { wmRestore(WIN_ID); wmFocus(WIN_ID); return; }

    const c = el('div', { className: 'grules-window' });

    const hint = el('div', { className: 'grules-hint' });
    hint.innerHTML =
        'Правила применяются к адресу ярлыка: если хост содержит шаблон — ярлык попадает в указанную категорию.<br>' +
        'Пользовательские правила важнее встроенного словаря (' + CATEGORIES.length + ' категорий: ' +
        escapeHtml(CATEGORIES.slice(0, 5).map(cat => cat.name).join(', ')) + ' и др.).';
    c.appendChild(hint);

    const rows = el('div', { className: 'grules-rows' });
    c.appendChild(rows);

    function persist(): void {
        const rules: GroupRule[] = [];
        rows.querySelectorAll<HTMLElement>('.grules-row').forEach(row => {
            const pattern = (row.querySelector('.grules-pattern') as HTMLInputElement).value.trim();
            const category = (row.querySelector('.grules-category') as HTMLInputElement).value.trim();
            if (pattern && category) rules.push({ pattern, category });
        });
        saveGroupRules(rules);
    }

    function addRow(pattern = '', category = ''): void {
        const row = el('div', { className: 'grules-row' });
        const pInp = el('input', { className: 'grules-pattern', type: 'text', placeholder: 'habr', value: pattern }) as HTMLInputElement;
        const cInp = el('input', { className: 'grules-category', type: 'text', placeholder: 'Разработка', value: category }) as HTMLInputElement;
        cInp.setAttribute('list', 'grules-cats');
        pInp.addEventListener('input', persist);
        cInp.addEventListener('input', persist);
        const del = el('button', { className: 'xp-dialog-btn grules-del', text: '✕', title: 'Удалить правило' });
        del.addEventListener('click', () => { row.remove(); persist(); });
        row.appendChild(pInp);
        row.appendChild(el('span', { className: 'grules-arrow', text: '→' }));
        row.appendChild(cInp);
        row.appendChild(del);
        rows.appendChild(row);
    }

    // Список существующих категорий для подсказки при вводе
    const dataList = el('datalist', { id: 'grules-cats' });
    CATEGORIES.forEach(cat => dataList.appendChild(el('option', { value: cat.name })));
    c.appendChild(dataList);

    getGroupRules().forEach(r => addRow(r.pattern, r.category));

    const bd = el('div', { className: 'grules-footer' });
    const addBtn = el('button', { className: 'xp-dialog-btn', text: '+ Добавить правило' });
    addBtn.addEventListener('click', () => addRow());
    const resetBtn = el('button', { className: 'xp-dialog-btn', text: 'По умолчанию', title: 'Удалить все пользовательские правила' });
    resetBtn.addEventListener('click', () => { rows.innerHTML = ''; saveGroupRules([]); });
    bd.appendChild(addBtn);
    bd.appendChild(resetBtn);
    c.appendChild(bd);

    wmCreate(WIN_ID, 'Категории ярлыков', c, 420, 320, xpIconHtml('favorites', 16));
}
