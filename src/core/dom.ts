// DOM-хелперы: экранирование, создание элементов, XP-иконки.

/** Экранирование строки для вставки в innerHTML. ОБЯЗАТЕЛЬНО для всех пользовательских/сайтовых данных. */
export function escapeHtml(s: unknown): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** HTML-строка иконки из runtime-набора icons/<size>/<name>.png (как xpIcon() в оригинале). */
export function xpIconHtml(name: string, size = 16): string {
    return '<img class="xp-icon-img" src="icons/' + size + '/' + escapeHtml(name) + '.png" width="' + size + '" height="' + size + '" alt="">';
}

/** URL иконки из runtime-набора (для программного присвоения img.src). */
export function xpIconSrc(name: string, size = 16): string {
    return 'icons/' + size + '/' + name + '.png';
}

/** Фавиконка сайта через внутренний сервис Chrome. */
export function getFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(urlObj.href)}&size=32`;
    } catch {
        return '';
    }
}

type ElProps = {
    id?: string;
    className?: string;
    text?: string;
    html?: string;      // только для доверенной разметки (иконки, svg) — пользовательские строки прогонять через escapeHtml
    style?: string;
    title?: string;
    type?: string;      // для input/button
    placeholder?: string;
    value?: string;
    src?: string;
    alt?: string;
    dataset?: Record<string, string>;
    on?: Partial<{ [E in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[E]) => void }>;
};

/** Компактное создание элемента. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: ElProps = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (props.id) node.id = props.id;
    if (props.className) node.className = props.className;
    if (props.text !== undefined) node.textContent = props.text;
    if (props.html !== undefined) node.innerHTML = props.html;
    if (props.style) node.style.cssText = props.style;
    if (props.title) node.title = props.title;
    if (props.type) (node as HTMLInputElement).type = props.type;
    if (props.placeholder) (node as HTMLInputElement).placeholder = props.placeholder;
    if (props.value !== undefined) (node as HTMLInputElement).value = props.value;
    if (props.src) (node as HTMLImageElement).src = props.src;
    if (props.alt !== undefined) (node as HTMLImageElement).alt = props.alt;
    if (props.dataset) for (const [k, v] of Object.entries(props.dataset)) node.dataset[k] = v;
    if (props.on) for (const [evt, fn] of Object.entries(props.on)) node.addEventListener(evt, fn as EventListener);
    for (const child of children) {
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

/** Поиск элемента с гарантией типа; кидает понятную ошибку, если контракт разметки сломан. */
export function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error('[XP] элемент #' + id + ' не найден в DOM');
    return node as T;
}
