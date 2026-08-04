// Service worker расширения (порт background.js оригинала на TypeScript).
// Обрабатывает сообщения страницы новой вкладки: захват скриншотов,
// заголовки страниц, поисковые подсказки; хуки яндекс-сборки.

type SendResponse = (response?: unknown) => void;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'capture_screenshot') {
        captureTab(message.url, sendResponse);
        return true;
    }
    if (message.action === 'fetch_page_title') {
        fetchPageTitle(message.url, sendResponse);
        return true;
    }
    if (message.action === 'fetch_suggestions') {
        fetchSuggestions(message.engine, message.q, sendResponse);
        return true;
    }
});

async function fetchSuggestions(engine: string, q: string, sendResponse: SendResponse): Promise<void> {
    try {
        const query = (q || '').trim();
        if (!query) { sendResponse({ success: true, items: [] }); return; }
        const url = engine === 'go'
            ? 'https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(query)
            : 'https://suggest.yandex.ru/suggest-ff.cgi?part=' + encodeURIComponent(query);
        const resp = await fetch(url);
        if (!resp.ok) { sendResponse({ success: false }); return; }
        const data = await resp.json();
        const items = Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
        sendResponse({ success: true, items });
    } catch {
        sendResponse({ success: false });
    }
}

async function fetchPageTitle(url: string, sendResponse: SendResponse): Promise<void> {
    try {
        const resp = await fetch(url, { headers: { 'Accept': 'text/html' } });
        if (!resp.ok) { sendResponse({ success: false }); return; }
        const html = await resp.text();
        const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
        if (!match) { sendResponse({ success: false }); return; }
        const title = match[1].trim()
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
        sendResponse({ success: true, title });
    } catch {
        sendResponse({ success: false });
    }
}

// Проверяем, можно ли вообще делать скриншот/fetch для данного URL
function isCapturableUrl(url: string): boolean {
    try {
        const u = new URL(url);
        // Только http/https
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        // Магазины расширений — запрещено браузером
        if (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore')) return false;
        if (u.hostname === 'microsoftedge.microsoft.com' && u.pathname.startsWith('/addons')) return false;
        if (u.hostname === 'addons.mozilla.org') return false;
        return true;
    } catch {
        return false;
    }
}

async function captureTab(url: string, sendResponse: SendResponse): Promise<void> {
    // Ранний выход для URL, которые браузер запрещает захватывать
    if (!isCapturableUrl(url)) {
        sendResponse({ success: false, error: 'URL не поддерживает захват миниатюры' });
        return;
    }

    // Скриншот через popup-окно
    try {
        const win = await chrome.windows.create({
            url: url,
            left: 0,
            top: 0,
            width: 1024,
            height: 768,
            type: 'popup',
            focused: false
        });
        if (!win || !win.tabs || !win.tabs.length || win.id == null) {
            sendResponse({ success: false, error: 'Не удалось открыть окно захвата' });
            return;
        }
        const winId = win.id;

        const targetTabId = win.tabs[0].id!;
        let captured = false;

        const doCapture = async (): Promise<void> => {
            if (captured) return;
            captured = true;
            clearTimeout(fallbackTimer);
            chrome.tabs.onUpdated.removeListener(onUpdated);

            // Ждём рендеринг SPA-сайтов
            setTimeout(async () => {
                try {
                    await chrome.windows.update(winId, { focused: true });
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const dataUrl = await chrome.tabs.captureVisibleTab(winId, { format: 'jpeg', quality: 50 });
                    const compressedBase64 = await resizeImage(dataUrl, 300, 218);

                    chrome.windows.remove(winId).catch(() => {});
                    sendResponse({ success: true, dataUrl: compressedBase64 });
                } catch (e) {
                    chrome.windows.remove(winId).catch(() => {});
                    sendResponse({ success: false, error: (e as Error).message });
                }
            }, 2500);
        };

        const fallbackTimer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            if (!captured) {
                captured = true;
                chrome.windows.remove(winId).catch(() => {});
                try { sendResponse({ success: false, error: 'Timeout' }); } catch { /* ignore */ }
            }
        }, 15000);

        const onUpdated = (tabId: number, info: { status?: string }): void => {
            if (tabId === targetTabId && info.status === 'complete') doCapture();
        };

        chrome.tabs.onUpdated.addListener(onUpdated);

        // Race condition fix: если таб уже загрузился до того, как мы повесили слушатель
        chrome.tabs.get(targetTabId).then(tab => {
            if (tab.status === 'complete') doCapture();
        }).catch(() => {});
    } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
    }
}

// Ресайз картинки в нужный размер и формат
async function resizeImage(src: string, width: number, height: number): Promise<string> {
    const response = await fetch(src);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Вписываем с сохранением пропорций (cover)
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const sw = bitmap.width * scale;
    const sh = bitmap.height * scale;
    const sx = (width - sw) / 2;
    const sy = (height - sh) / 2;
    ctx.drawImage(bitmap, sx, sy, sw, sh);
    bitmap.close();

    const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const buffer = await resultBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:image/jpeg;base64,' + btoa(binary);
}

// ==================== YANDEX BUILD (кнопка тулбара и горячая клавиша) ====================
// Яндекс.Браузер не поддерживает chrome_url_overrides.newtab, поэтому в яндекс-сборке
// страница открывается кнопкой на тулбаре и командой. В основной сборке action
// объявлен (открывает страницу в новой вкладке), commands — нет.
if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener(function () {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    });
}
if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(function (cmd) {
        if (cmd === 'open-xp-desktop') chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    });
}

// ==================== YANDEX BUILD: обход Табло (эксперимент) ====================
// Яндекс запрещает chrome_url_overrides, но chrome.tabs.update может увести
// вкладку с внутренней стартовой страницы на нашу. Работает только в яндекс-сборке
// (определяется по отсутствию chrome_url_overrides в манифесте).
const XP_STARTPAGE_URLS = ['browser://tableau/', 'browser://newtab/', 'chrome://newtab/'];
const xpIsYandexBuild = !chrome.runtime.getManifest().chrome_url_overrides;
const xpLastRedirect: Record<number, number> = {};

// Отложенный редирект: ждём и перепроверяем URL — клики по поисковым
// подсказкам Табло тоже стартуют с пустого url, но быстро получают настоящий
function xpDeferredRedirect(tabId: number, tag: string): void {
    setTimeout(function () {
        chrome.tabs.get(tabId, function (tab) {
            if (chrome.runtime.lastError || !tab) return;
            const url = tab.url || '';
            if (url && XP_STARTPAGE_URLS.indexOf(url) === -1) {
                console.log('[XP] ' + tag + ' skip (real url): ' + url); // появился настоящий URL — не трогаем
                return;
            }
            const now = Date.now();
            if (xpLastRedirect[tabId] && now - xpLastRedirect[tabId] < 2000) return;
            xpLastRedirect[tabId] = now;
            chrome.tabs.update(tabId, { url: chrome.runtime.getURL('index.html') }, function () {
                if (chrome.runtime.lastError) console.warn('[XP] ' + tag + ' redirect failed:', chrome.runtime.lastError.message);
                else console.log('[XP] ' + tag + ' redirect ok, tab ' + tabId);
            });
        });
    }, 700);
}

// Проверено на живом Яндексе: Табло отдаётся как ПУСТОЙ url. Редиректим только
// свежие вкладки без вкладки-источника (у контекстного меню Табло openerTabId есть).
chrome.tabs.onCreated.addListener(function (tab) {
    if (!xpIsYandexBuild || tab.openerTabId) return;
    const url = tab.url || tab.pendingUrl || '';
    if (url && XP_STARTPAGE_URLS.indexOf(url) === -1) return;
    xpDeferredRedirect(tab.id!, 'onCreated');
});

// Диагностика хоткея: какие команды и с какими клавишами реально зарегистрированы
if (xpIsYandexBuild && chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(function (cmds) { console.log('[XP] commands: ' + JSON.stringify(cmds)); });
}
