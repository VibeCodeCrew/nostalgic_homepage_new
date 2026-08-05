// Веб-приложения: ярлык с флагом app открывается в XP-окне с iframe,
// оформленном под Internet Explorer 6. Порт WEB APPS (script.js:4934-5186).
// Анти-фрейминговые заголовки сайтов (X-Frame-Options, CSP) снимаются
// DNR-правилом только для нашей вкладки — см. initWebAppFrameRules.

import './webapps.css';
import { getFaviconUrl, xpIconHtml } from '../../core/dom';
import { settings } from '../../core/state';
import { showNotification } from '../../core/notifications';
import type { LinkItem } from '../../core/types';
import { wmCreate, wmGet, wmRestore, wmFocus, wmClose, wmMaximize } from '../../wm/windowManager';
import { openBrowserBookmarks } from '../explorer';
import { searchUrlFor, setWebAppOpener } from '../desktop';

interface WebAppEntry { name: string; url: string }

// Реестр запущенных веб-приложений: winId → {name, url}.
// Свой реестр нужен, т.к. wmClose зовёт onClose до удаления окна из wmWindows.
const webAppRegistry: Record<string, WebAppEntry> = {};
// Генерационный счётчик против гонок асинхронной загрузки фавиконок
let tabIconGen = 0;
// Таймер бегущей строки заголовка вкладки (один на страницу)
let tabTitleTimer: ReturnType<typeof setInterval> | null = null;

// Обновление заголовка и иконки вкладки по списку запущенных веб-приложений:
// заголовок — имена через " | ", иконка — полоса фавиконок на canvas.
// При удалении последнего веб-приложения бегущая строка останавливается,
// заголовок и фавиконка вкладки восстанавливаются (как в оригинале).
function updateTabIdentity(): void {
    const apps = Object.keys(webAppRegistry).map(id => webAppRegistry[id]);
    const gen = ++tabIconGen;
    // Прокрутка прежнего заголовка останавливается при любом пересчёте — таймер один
    if (tabTitleTimer) { clearInterval(tabTitleTimer); tabTitleTimer = null; }
    const link = document.getElementById('webapp-tab-icon');
    if (apps.length === 0) {
        document.title = 'Новая вкладка';
        if (link) link.remove();
        return;
    }
    const base = apps.map(a => {
        if (a.name) return a.name;
        try { return new URL(a.url).hostname; } catch { return a.url; }
    }).join(' | ');
    // Длинную строку прокручиваем по кругу (ширину заголовка вкладки измерить
    // нельзя — порог в символах); короткая остаётся статичной
    if (base.length <= 30) {
        document.title = base;
    } else {
        let padded = base + ' | '; // хвост-разделитель — бесшовное зацикливание
        document.title = padded;
        tabTitleTimer = setInterval(() => {
            padded = padded.slice(1) + padded[0];
            document.title = padded;
        }, 250); // скорость прокрутки: 1 символ / 250 мс
    }
    // Фавиконки — только через _favicon-сервис (same-origin, canvas не тейнтится);
    // customIcon с чужого origin запачкал бы canvas и сломал toDataURL.
    const urls = apps.slice(0, 4).map(a => getFaviconUrl(a.url)).filter(Boolean);
    if (urls.length === 0) { if (link) link.remove(); return; }
    let done = 0;
    const imgs: (HTMLImageElement | null)[] = [];
    urls.forEach((src, i) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            imgs[i] = (img.naturalWidth > 0) ? img : null;
            if (++done < urls.length) return;
            if (gen !== tabIconGen) return; // пришло более новое состояние
            const ok = imgs.filter(Boolean) as HTMLImageElement[];
            let link2 = document.getElementById('webapp-tab-icon') as HTMLLinkElement | null;
            if (ok.length === 0) { if (link2) link2.remove(); return; }
            const cv = document.createElement('canvas');
            cv.width = 16 * ok.length; cv.height = 16;
            const ctx = cv.getContext('2d');
            if (!ctx) { if (link2) link2.remove(); return; }
            ok.forEach((im, j) => { ctx.drawImage(im, j * 16, 0, 16, 16); });
            try {
                const dataUrl = cv.toDataURL('image/png');
                if (!link2) {
                    link2 = document.createElement('link');
                    link2.id = 'webapp-tab-icon';
                    link2.rel = 'icon';
                    document.head.appendChild(link2);
                }
                link2.href = dataUrl;
            } catch { if (link2) link2.remove(); }
        };
        img.src = src;
    });
}

type IeMenuEntry = { label: string; action: () => void; disabled?: boolean } | 'sep';

// Веб-приложение оформляется под Internet Explorer 6: меню-бар, тулбар,
// адрес-бар, iframe, статус-бар (см. референс). Известные ограничения:
// адресная строка не отслеживает навигацию внутри iframe (cross-origin
// location.href недоступен) и «Обновить» cross-origin перезагружает
// исходный URL ярлыка, а не текущую внутреннюю страницу.
export function openWebApp(item: LinkItem): void {
    let h = 0;
    const u = item.url || '';
    for (let i = 0; i < u.length; i++) h = ((h * 31) + u.charCodeAt(i)) >>> 0;
    const winId = 'webapp-' + h.toString(36);
    if (wmGet(winId)) { wmRestore(winId); wmFocus(winId); return; }
    const c = document.createElement('div');
    c.className = 'webapp-window';

    const ifr = document.createElement('iframe');
    ifr.className = 'webapp-frame';
    ifr.src = u;

    // --- навигационные действия (общие для тулбара, адрес-бара и меню) ---
    let addrInput: HTMLInputElement;
    function navTo(url: string): void { ifr.src = url; if (addrInput) addrInput.value = url; }
    function ieBack(): void    { try { ifr.contentWindow!.history.back(); } catch { /* ignore */ } }
    function ieForward(): void { try { ifr.contentWindow!.history.forward(); } catch { /* ignore */ } }
    function ieStop(): void    { navTo('about:blank'); }
    function ieRefresh(): void { try { ifr.contentWindow!.location.reload(); } catch { ifr.src = ifr.src; } }
    function ieHome(): void    { navTo(u); }
    function ieGo(): void {
        let v = addrInput.value.trim(); if (!v) return;
        if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(v)) v = 'https://' + v;
        navTo(v);
    }

    // --- меню-бар: Файл / Правка / Вид / Избранное / Сервис / Справка ---
    const menuBar = document.createElement('div'); menuBar.className = 'ie-menubar';
    const openMenus: { el: HTMLElement; dd: HTMLElement }[] = [];
    function closeIeMenus(): void {
        openMenus.forEach(m => { m.dd.classList.add('hidden'); m.el.classList.remove('open'); });
        openMenus.length = 0;
    }
    function ieMenu(label: string, items: IeMenuEntry[] | null): void {
        const menuEl = document.createElement('span');
        menuEl.className = 'ie-menu-item'; menuEl.textContent = label;
        if (!items) { menuEl.classList.add('disabled'); menuBar.appendChild(menuEl); return; }
        const dd = document.createElement('div'); dd.className = 'ie-dropdown hidden';
        items.forEach(it => {
            if (it === 'sep') { const s = document.createElement('div'); s.className = 'ie-dropdown-sep'; dd.appendChild(s); return; }
            const d = document.createElement('div');
            d.className = 'ie-dropdown-item' + (it.disabled ? ' disabled' : '');
            d.textContent = it.label;
            if (!it.disabled) d.addEventListener('click', e => { e.stopPropagation(); closeIeMenus(); it.action(); });
            dd.appendChild(d);
        });
        menuEl.appendChild(dd);
        menuEl.addEventListener('click', e => {
            e.stopPropagation();
            const wasOpen = !dd.classList.contains('hidden');
            closeIeMenus();
            if (!wasOpen) { dd.classList.remove('hidden'); menuEl.classList.add('open'); openMenus.push({ el: menuEl, dd: dd }); }
        });
        menuBar.appendChild(menuEl);
    }
    document.addEventListener('click', closeIeMenus);
    ieMenu('Файл', [
        { label: 'Открыть в новой вкладке', action: () => { window.open(addrInput ? addrInput.value : u, '_blank'); } },
        'sep',
        { label: 'Закрыть окно', action: () => { wmClose(winId); } },
    ]);
    ieMenu('Правка', null);
    ieMenu('Вид', [
        { label: 'Обновить', action: ieRefresh },
        { label: 'Домашняя страница', action: ieHome },
        'sep',
        { label: 'Развернуть', action: () => { wmMaximize(winId); } },
    ]);
    ieMenu('Избранное', [
        { label: 'Закладки браузера', action: () => { openBrowserBookmarks(); } },
    ]);
    ieMenu('Сервис', null);
    ieMenu('Справка', [
        { label: 'О программе…', action: () => { showNotification('Internet Explorer 6', 'Веб-приложение — Nostalgic Startpage', '🌐'); } },
    ]);
    c.appendChild(menuBar);

    // --- тулбар: Назад / Вперёд / Стоп / Обновить / Домой | Поиск / Избранное ---
    const toolbar = document.createElement('div'); toolbar.className = 'ie-toolbar';
    function ieBtn(iconHtml: string, label: string, action: () => void): HTMLButtonElement {
        const b = document.createElement('button');
        b.className = 'ie-tbtn'; b.type = 'button';
        b.innerHTML = iconHtml + '<span>' + label + '</span>';
        b.addEventListener('click', action);
        toolbar.appendChild(b);
        return b;
    }
    function ieSep(): void { const s = document.createElement('div'); s.className = 'ie-tsep'; toolbar.appendChild(s); }
    ieBtn(xpIconHtml('back', 24), 'Назад', ieBack);
    ieBtn(xpIconHtml('forward', 24), 'Вперёд', ieForward);
    ieBtn(xpIconHtml('ie-stop', 24), 'Стоп', ieStop);
    ieBtn(xpIconHtml('ie-refresh', 24), 'Обновить', ieRefresh);
    ieBtn(xpIconHtml('ie-home', 24), 'Домой', ieHome);
    ieSep();
    ieBtn(xpIconHtml('search', 24), 'Поиск', () => { navTo(searchUrlFor(settings.searchEngine, '')); });
    ieBtn(xpIconHtml('favorites', 24), 'Избранное', () => { openBrowserBookmarks(); });
    c.appendChild(toolbar);

    // --- адрес-бар ---
    const addrBar = document.createElement('div'); addrBar.className = 'ie-addrbar';
    addrBar.innerHTML = '<label>Адрес</label>' + xpIconHtml('internet', 16);
    addrInput = document.createElement('input');
    addrInput.className = 'ie-addr-input'; addrInput.type = 'text'; addrInput.value = u;
    addrInput.addEventListener('keydown', e => { if (e.key === 'Enter') ieGo(); });
    const goBtn = document.createElement('button');
    goBtn.className = 'ie-go-btn'; goBtn.type = 'button';
    goBtn.innerHTML = xpIconHtml('go', 16) + '<span>Переход</span>';
    goBtn.addEventListener('click', ieGo);
    addrBar.appendChild(addrInput); addrBar.appendChild(goBtn);
    c.appendChild(addrBar);

    c.appendChild(ifr);

    // --- статус-бар ---
    const statusBar = document.createElement('div'); statusBar.className = 'ie-statusbar';
    statusBar.innerHTML =
        '<span class="ie-status-cell" style="flex:1">' + xpIconHtml('internet', 16) + '<span>Готово</span></span>' +
        '<span class="ie-status-cell">' + xpIconHtml('internet', 16) + '<span>Интернет</span></span>';
    c.appendChild(statusBar);

    const fav = getFaviconUrl(u);
    const iconHtml = fav
        ? '<img class="xp-icon-img" src="' + fav + '" width="16" height="16" alt="">'
        : xpIconHtml('internet-shortcut', 16);
    wmCreate(winId, (item.name || u) + ' — Internet Explorer', c,
        Math.min(1024, window.innerWidth - 60), Math.min(700, window.innerHeight - 80),
        iconHtml);
    webAppRegistry[winId] = { name: item.name || '', url: u };
    const w = wmGet(winId);
    if (w) w.onClose = () => {
        document.removeEventListener('click', closeIeMenus);
        delete webAppRegistry[winId];
        updateTabIdentity();
    };
    updateTabIdentity();
}

// Снятие X-Frame-Options / CSP у ответов под-фреймов ТОЛЬКО нашей вкладки
// (session-правила: живут до перезапуска браузера, другие вкладки не затронуты)
export function initWebAppFrameRules(): void {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest || !chrome.tabs || !chrome.tabs.getCurrent) return;
    chrome.tabs.getCurrent(tab => {
        if (!tab || tab.id == null) return;
        chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [9001],
            addRules: [{
                id: 9001,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                    responseHeaders: [
                        { header: 'x-frame-options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
                        { header: 'content-security-policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
                        { header: 'content-security-policy-report-only', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
                        { header: 'frame-options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
                    ],
                },
                condition: {
                    tabIds: [tab.id],
                    resourceTypes: ['sub_frame' as chrome.declarativeNetRequest.ResourceType],
                },
            }],
        });
    });
}

export function initWebApps(): void {
    // Связка с рабочим столом: ярлыки с флагом app открываются через openWebApp
    setWebAppOpener(openWebApp);
}
