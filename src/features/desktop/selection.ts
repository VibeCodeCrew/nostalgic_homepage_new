// Выделение иконок рабочего стола: updateSelectionUI + marquee (рамка).
// Порт updateSelectionUI (script.js ~195) и rubber-band (~8565-8618).
// ФИКС АУДИТА: rect'ы иконок кэшируются на mousedown, mousemove идёт через rafThrottle —
// никаких querySelectorAll/getBoundingClientRect на каждый move.

import { rafThrottle } from '../../core/debounce';
import { on } from '../../core/events';
import { clearSelection, selectedIndices, selectedSysIds } from '../../core/state';

export function updateSelectionUI(): void {
    document.querySelectorAll<HTMLElement>('.desktop-icon[data-index]').forEach(el => {
        const idx = parseInt(el.dataset.index || '', 10);
        const sel = !isNaN(idx) && selectedIndices.has(idx);
        el.classList.toggle('selected', sel);
        const xi = el.querySelector('.xp-icon');
        if (xi) xi.classList.toggle('selected', sel);
    });
    // Системные иконки — тоже участники выделения
    document.querySelectorAll<HTMLElement>('.sys-icon').forEach(el => {
        el.classList.toggle('selected', selectedSysIds.has(el.dataset.sysId || ''));
    });
}

/** Подписка на событие выделения из core (selectIcon/clearSelection эмитят 'selection-changed'). */
export function initSelection(): void {
    on('selection-changed', updateSelectionUI);
}

interface CachedRect {
    key: number | string;
    r: DOMRect;
}

/** Rubber-band (marquee) выделение на пустой области рабочего стола. */
export function initMarquee(iconsContainer: HTMLElement): void {
    iconsContainer.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('.desktop-icon')) return; // иконки обрабатывают свой mousedown сами
        e.preventDefault();
        if (!e.ctrlKey) clearSelection();

        const cRect = iconsContainer.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const preSelection = new Set(selectedIndices);
        const preSelectionSys = new Set(selectedSysIds);

        // ФИКС АУДИТА: кэшируем rect'ы один раз на mousedown — на mousemove не трогаем layout
        const iconRects: CachedRect[] = [];
        iconsContainer.querySelectorAll<HTMLElement>('.desktop-icon[data-index]').forEach(el => {
            const idx = parseInt(el.dataset.index || '', 10);
            if (!isNaN(idx)) iconRects.push({ key: idx, r: el.getBoundingClientRect() });
        });
        const sysRects: CachedRect[] = [];
        iconsContainer.querySelectorAll<HTMLElement>('.sys-icon').forEach(el => {
            sysRects.push({ key: el.dataset.sysId || '', r: el.getBoundingClientRect() });
        });

        const rb = document.createElement('div');
        rb.id = 'selection-rect';
        rb.style.cssText = 'left:' + (sx - cRect.left) + 'px; top:' + (sy - cRect.top) + 'px; width:0; height:0;';
        iconsContainer.appendChild(rb);

        const applyMove = rafThrottle((ev: MouseEvent) => {
            if (!rb.parentNode) return;
            const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY);
            const x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
            rb.style.left = (x1 - cRect.left) + 'px';
            rb.style.top = (y1 - cRect.top) + 'px';
            rb.style.width = (x2 - x1) + 'px';
            rb.style.height = (y2 - y1) + 'px';

            selectedIndices.clear();
            preSelection.forEach(i => selectedIndices.add(i));
            iconRects.forEach(c => {
                const r = c.r;
                if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) selectedIndices.add(c.key as number);
            });
            // Системные иконки тоже захватываются рамкой
            selectedSysIds.clear();
            preSelectionSys.forEach(id => selectedSysIds.add(id));
            sysRects.forEach(c => {
                const r = c.r;
                if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) selectedSysIds.add(c.key as string);
            });
            updateSelectionUI();
        });

        function onMove(ev: MouseEvent): void {
            applyMove(ev);
        }
        function onUp(): void {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (rb.parentNode) rb.remove();
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}
