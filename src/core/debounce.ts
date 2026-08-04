// debounce / throttle / rAF-throttle — общие хелперы производительности.

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: unknown, ...args: A) {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, ms);
    };
}

export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: unknown, ...args: A) {
        const now = Date.now();
        const run = () => {
            last = Date.now();
            timer = null;
            fn.apply(this, args);
        };
        if (now - last >= ms) run();
        else if (!timer) timer = setTimeout(run, ms - (now - last));
    };
}

/** Пропускает вызовы, пока текущий кадр не отрисован; выполняется максимум раз за кадр с последними аргументами. */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
    let scheduled = false;
    let lastArgs: A;
    return function (this: unknown, ...args: A) {
        lastArgs = args;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            fn.apply(this, lastArgs);
        });
    };
}
