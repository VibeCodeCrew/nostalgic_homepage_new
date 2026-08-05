// Окно «Свойства: Экран» — порт SETTINGS (script.js:4125-4329).
// Табы: Тема / Рабочий стол / Заставка / Параметры.

import { STORAGE } from '../../core/keys';
import { getBool, getInt, setItem, removeItem } from '../../core/store';
import { settings, updateSetting, setUsername, username } from '../../core/state';
import { xpIconHtml } from '../../core/dom';
import { registerAction, runAction, ACTION } from '../../core/actions';
import { wmClose, wmCreate, wmFocus, wmGet, wmResizeToContent, wmRestore } from '../../wm/windowManager';
import { renderDesktop, renderDesktopDebounced, ensureSearchWidget } from '../desktop';
import { setTheme, applyBackground } from '../themes';
import type { ThemeId, ViewMode, SearchEngine, Settings } from '../../core/types';

// Числовые настройки, которыми управляют слайдеры mkR
type NumSettingKey = 'tileWidth' | 'tileHeight' | 'glassTileWidth' | 'glassTileHeight' | 'opacity' | 'iconSize';

function openSettings(): void {
    if (wmGet('settings')) { wmRestore('settings'); wmFocus('settings'); return; }
    const c = document.createElement('div');
    c.style.cssText = 'display:flex;flex-direction:column;height:100%;font-family:Tahoma,sans-serif;font-size:11px;padding:8px;box-sizing:border-box;overflow:auto;';

    // Tabs
    const tabBar = document.createElement('div'); tabBar.className = 'settings-tabs';
    const tabNames: [string, string][] = [['theme', 'Тема'], ['desktop', 'Рабочий стол'], ['screensaver', 'Заставка'], ['params', 'Параметры']];
    const tabPanels: Record<string, HTMLElement> = {};
    tabNames.forEach((tn, i) => {
        const btn = document.createElement('div'); btn.className = 'settings-tab' + (i === 0 ? ' active' : '');
        btn.textContent = tn[1]; btn.dataset.tab = tn[0]; tabBar.appendChild(btn);
        const p = document.createElement('div'); p.className = 'settings-tab-content settings-form' + (i === 0 ? ' active' : '');
        tabPanels[tn[0]] = p;
    });
    tabBar.addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest('.settings-tab') as HTMLElement | null; if (!btn) return;
        tabBar.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(tabPanels).forEach(p => p.classList.remove('active'));
        tabPanels[btn.dataset.tab!].classList.add('active');
    });
    c.appendChild(tabBar);
    Object.values(tabPanels).forEach(p => c.appendChild(p));

    // --- Tab: Тема ---
    const tP = tabPanels['theme'];
    // Тема рабочего стола (XP / Mac OS X Aqua)
    const thG = document.createElement('div'); thG.className = 'form-group'; thG.innerHTML = '<label>Тема: </label>';
    const thS = document.createElement('select'); thS.style.cssText = 'margin-left:4px;font-size:11px;';
    ([['xp', 'Windows XP'], ['macos', 'Mac OS X Aqua']] as [ThemeId, string][]).forEach(opt => {
        const o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1];
        if (settings.theme === opt[0]) o.selected = true;
        thS.appendChild(o);
    });
    thG.appendChild(thS); tP.appendChild(thG);
    thS.addEventListener('change', () => {
        setTheme(thS.value as ThemeId);
    });
    const vg = document.createElement('div'); vg.className = 'form-group'; vg.innerHTML = '<label>Режим вида: </label>';
    const vs = document.createElement('select'); vs.style.cssText = 'margin-left:4px;font-size:11px;';
    ([['glass', 'Плитки (стекло)'], ['window', 'Окна с превью'], ['icon', 'Ярлыки XP']] as [ViewMode, string][]).forEach(opt => {
        const o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1];
        if (settings.viewMode === opt[0]) o.selected = true;
        vs.appendChild(o);
    });
    vg.appendChild(vs); tP.appendChild(vg);
    const modeBlock = document.createElement('div'); modeBlock.className = 'settings-mode-block'; tP.appendChild(modeBlock);

    function mkR(label: string, key: NumSettingKey, min: number, max: number, sfx: string, step?: number): void {
        const g = document.createElement('div'); g.className = 'form-group';
        const l = document.createElement('label'); l.textContent = label + ': ';
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = String(min); inp.max = String(max);
        inp.step = String(step || 1); inp.value = String(settings[key]);
        const vl = document.createElement('span');
        vl.textContent = (key === 'opacity' ? Math.round(settings[key] * 100) : settings[key]) + sfx;
        l.appendChild(inp); l.appendChild(vl); g.appendChild(l); modeBlock.appendChild(g);
        inp.addEventListener('input', () => {
            const v = parseFloat(inp.value);
            updateSetting(key, v as Settings[NumSettingKey]);
            vl.textContent = (key === 'opacity' ? Math.round(v * 100) : v) + sfx;
            // ФИКС АУДИТА: перерисовка по debounce (в оригинале — полный ребилд на каждый input)
            renderDesktopDebounced();
        });
    }

    function buildModeControls(): void {
        modeBlock.innerHTML = '';
        if (settings.viewMode === 'window') {
            mkR('Ширина превью', 'tileWidth', 80, 300, 'px');
            mkR('Высота превью', 'tileHeight', 50, 300, 'px');
        } else if (settings.viewMode === 'glass') {
            const cg = document.createElement('div'); cg.className = 'form-group'; cg.innerHTML = '<label>Колонок в ряду </label>';
            const ci = document.createElement('input'); ci.type = 'number'; ci.min = '2'; ci.max = '12'; ci.value = String(settings.glassCols); ci.style.width = '50px';
            cg.querySelector('label')!.appendChild(ci); modeBlock.appendChild(cg);
            ci.addEventListener('input', () => {
                updateSetting('glassCols', parseInt(ci.value, 10) || 4);
                renderDesktopDebounced();
            });
            mkR('Ширина плиток', 'glassTileWidth', 50, 300, 'px'); mkR('Высота плиток', 'glassTileHeight', 50, 300, 'px'); mkR('Прозрачность', 'opacity', 0.1, 1, '%', 0.05);
            const sBgG = document.createElement('div'); sBgG.className = 'form-group';
            const sBgChk = document.createElement('input'); sBgChk.type = 'checkbox'; sBgChk.checked = settings.glassScreenshotBg;
            const sBgLbl = document.createElement('label'); sBgLbl.style.cursor = 'pointer';
            sBgLbl.appendChild(sBgChk); sBgLbl.append(' Скриншот как фон плитки'); sBgG.appendChild(sBgLbl); modeBlock.appendChild(sBgG);
            sBgChk.addEventListener('change', () => {
                updateSetting('glassScreenshotBg', sBgChk.checked);
                renderDesktop();
            });
        } else if (settings.viewMode === 'icon') {
            mkR('Размер иконок', 'iconSize', 40, 120, 'px');
        }
    }
    buildModeControls();
    vs.addEventListener('change', () => {
        updateSetting('viewMode', vs.value as ViewMode);
        buildModeControls();
        renderDesktop();
    });

    // --- Tab: Рабочий стол ---
    const dP = tabPanels['desktop'];
    const bgBtns = document.createElement('div'); bgBtns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;';
    const setBgBtn = document.createElement('button'); setBgBtn.className = 'xp-dialog-btn'; setBgBtn.textContent = 'Выбрать фон...';
    const resetBgBtn = document.createElement('button'); resetBgBtn.className = 'xp-dialog-btn'; resetBgBtn.textContent = 'По умолчанию';
    bgBtns.appendChild(setBgBtn); bgBtns.appendChild(resetBgBtn); dP.appendChild(bgBtns);
    const ugD = document.createElement('div'); ugD.className = 'form-group'; ugD.style.marginTop = '10px'; ugD.innerHTML = '<label>Имя пользователя: </label>';
    const uI = document.createElement('input'); uI.type = 'text'; uI.value = username; uI.style.width = '120px';
    ugD.querySelector('label')!.appendChild(uI); dP.appendChild(ugD);
    setBgBtn.addEventListener('click', () => { document.getElementById('bg-upload')!.click(); });
    resetBgBtn.addEventListener('click', () => { removeItem(STORAGE.bg); applyBackground(); });
    // UI (меню Пуск) обновится по событию 'user-changed' из setUsername
    uI.addEventListener('change', () => { setUsername(uI.value.trim() || 'User'); });

    // --- Tab: Заставка ---
    const sP = tabPanels['screensaver'];
    const ssEnabled = getBool('edge_ss_enabled', true);
    const ssDelay = getInt('edge_ss_delay', 5);
    const ssChkG = document.createElement('div'); ssChkG.className = 'form-group';
    const ssChk = document.createElement('input'); ssChk.type = 'checkbox'; ssChk.checked = ssEnabled;
    const ssChkLbl = document.createElement('label'); ssChkLbl.style.cursor = 'pointer';
    ssChkLbl.appendChild(ssChk); ssChkLbl.append(' Включить заставку (трубы)');
    ssChkG.appendChild(ssChkLbl); sP.appendChild(ssChkG);
    const ssDelayG = document.createElement('div'); ssDelayG.className = 'form-group';
    ssDelayG.innerHTML = '<label>Задержка: </label>';
    const ssDelayInp = document.createElement('input'); ssDelayInp.type = 'range'; ssDelayInp.min = '1'; ssDelayInp.max = '30'; ssDelayInp.value = String(ssDelay);
    const ssDelayLbl = document.createElement('span'); ssDelayLbl.textContent = ssDelay + ' мин';
    ssDelayG.querySelector('label')!.appendChild(ssDelayInp); ssDelayG.querySelector('label')!.appendChild(ssDelayLbl); sP.appendChild(ssDelayG);
    const ssPrevBtn = document.createElement('button'); ssPrevBtn.className = 'xp-dialog-btn'; ssPrevBtn.textContent = 'Просмотр'; ssPrevBtn.style.marginTop = '6px'; sP.appendChild(ssPrevBtn);
    // Сам скринсейвер — Этап 5: действие 'reset-screensaver' пока no-op
    ssChk.addEventListener('change', () => { setItem('edge_ss_enabled', String(ssChk.checked)); runAction('reset-screensaver'); });
    ssDelayInp.addEventListener('input', () => {
        const v = parseInt(ssDelayInp.value, 10);
        ssDelayLbl.textContent = v + ' мин';
        setItem('edge_ss_delay', String(v));
        runAction('reset-screensaver');
    });
    ssPrevBtn.addEventListener('click', () => { wmClose('settings'); runAction(ACTION.startScreensaver); });

    // --- Tab: Параметры ---
    const parP = tabPanels['params'];
    parP.innerHTML = '<div style="color:#666;font-size:11px;">Параметры режима отображения доступны во вкладке «Тема».</div>';
    const clRow = document.createElement('div'); clRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;';
    const clChk = document.createElement('input'); clChk.type = 'checkbox'; clChk.id = 'settings-clippy-chk';
    clChk.checked = getBool('edge_clippy_enabled', true);
    clChk.addEventListener('change', () => {
        // Clippy — Этап 5: действие 'toggle-clippy' пока no-op
        setItem('edge_clippy_enabled', clChk.checked ? 'true' : 'false');
        runAction('toggle-clippy', { enabled: clChk.checked });
    });
    const clLbl = document.createElement('label'); clLbl.htmlFor = 'settings-clippy-chk';
    clLbl.textContent = 'Показывать помощника Скрепку';
    clLbl.style.cssText = 'font-family:Tahoma,sans-serif;font-size:11px;cursor:pointer;';
    clRow.appendChild(clChk); clRow.appendChild(clLbl); parP.appendChild(clRow);

    // Double-click option
    const dcRow = document.createElement('div'); dcRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;';
    const dcChk = document.createElement('input'); dcChk.type = 'checkbox'; dcChk.id = 'settings-dc-chk';
    dcChk.checked = !!settings.doubleClickOpen;
    dcChk.addEventListener('change', () => {
        updateSetting('doubleClickOpen', dcChk.checked);
    });
    const dcLbl = document.createElement('label'); dcLbl.htmlFor = 'settings-dc-chk';
    dcLbl.textContent = 'Открывать ярлыки двойным кликом (как в Windows XP)';
    dcLbl.style.cssText = 'font-family:Tahoma,sans-serif;font-size:11px;cursor:pointer;';
    dcRow.appendChild(dcChk); dcRow.appendChild(dcLbl); parP.appendChild(dcRow);

    // Search settings
    const seSep = document.createElement('div'); seSep.style.cssText = 'border-top:1px solid #d4d0c8;margin:12px 0 8px;'; parP.appendChild(seSep);
    const seTitle = document.createElement('div'); seTitle.textContent = 'Поиск'; seTitle.style.cssText = 'font-weight:bold;font-size:11px;margin-bottom:6px;'; parP.appendChild(seTitle);

    const seEngineRow = document.createElement('div'); seEngineRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:11px;';
    const seEngLbl = document.createElement('span'); seEngLbl.textContent = 'Поисковик по умолчанию:'; seEngineRow.appendChild(seEngLbl);
    (['ya', 'go'] as SearchEngine[]).forEach(eng => {
        const lbl = document.createElement('label'); lbl.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;gap:3px;';
        const r = document.createElement('input'); r.type = 'radio'; r.name = 'settings-search-engine'; r.value = eng;
        if (settings.searchEngine === eng) r.checked = true;
        r.addEventListener('change', () => {
            if (!r.checked) return;
            updateSetting('searchEngine', eng);
        });
        const tx = document.createTextNode(eng === 'ya' ? 'Яндекс' : 'Google');
        lbl.appendChild(r); lbl.appendChild(tx); seEngineRow.appendChild(lbl);
    });
    parP.appendChild(seEngineRow);

    const swRow = document.createElement('div'); swRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;';
    const swChk = document.createElement('input'); swChk.type = 'checkbox'; swChk.id = 'settings-search-widget-chk';
    swChk.checked = !!settings.searchWidget;
    swChk.addEventListener('change', () => {
        updateSetting('searchWidget', swChk.checked);
        ensureSearchWidget();
    });
    const swLbl = document.createElement('label'); swLbl.htmlFor = 'settings-search-widget-chk';
    swLbl.textContent = 'Показывать поиск в режимах Миниатюры и Ярлыки';
    swLbl.style.cssText = 'font-family:Tahoma,sans-serif;font-size:11px;cursor:pointer;';
    swRow.appendChild(swChk); swRow.appendChild(swLbl); parP.appendChild(swRow);

    wmCreate('settings', 'Свойства: Экран', c, 460, 520, xpIconHtml('control-panel', 16));
    setTimeout(() => {
        const content = document.querySelector('#win-settings .xp-win-content') as HTMLElement | null;
        if (content) {
            wmResizeToContent('settings', content.scrollWidth, content.scrollHeight, 400, 340, 720, 650);
        }
    }, 0);
}

export function initSettings(): void {
    registerAction(ACTION.openSettings, openSettings);
}
