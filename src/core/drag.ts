// Общий drag-helper: заменяет ~7 скопированных в оригинале паттернов
// «mousedown → document mousemove/mouseup». Гарантирует снятие слушателей.

export interface DocDragCallbacks {
    onStart?: (e: MouseEvent) => void;
    onMove?: (e: MouseEvent) => void;
    onEnd?: (e: MouseEvent) => void;
}

/**
 * Начать отслеживание перетаскивания (вызывать из mousedown/pointerdown).
 * Слушатели document снимаются автоматически на mouseup.
 * Возвращает функцию принудительной отмены.
 */
export function startDocDrag(e: MouseEvent, cb: DocDragCallbacks): () => void {
    const onM = (ev: MouseEvent): void => { cb.onMove?.(ev); };
    const onU = (ev: MouseEvent): void => {
        cancel();
        cb.onEnd?.(ev);
    };
    const cancel = (): void => {
        document.removeEventListener('mousemove', onM);
        document.removeEventListener('mouseup', onU);
    };
    document.addEventListener('mousemove', onM);
    document.addEventListener('mouseup', onU);
    cb.onStart?.(e);
    return cancel;
}

/** Обертка «перетаскивание элемента за ручку» с колбэками в пикселях смещения. */
export function makeDraggable(
    handle: HTMLElement,
    onMove: (dx: number, dy: number, e: MouseEvent) => void,
    onEnd?: (dx: number, dy: number, e: MouseEvent) => void,
    onStart?: (e: MouseEvent) => void,
): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        startDocDrag(e, {
            onStart: (ev) => onStart?.(ev),
            onMove: (ev) => onMove(ev.clientX - sx, ev.clientY - sy, ev),
            onEnd: (ev) => onEnd?.(ev.clientX - sx, ev.clientY - sy, ev),
        });
    });
}
