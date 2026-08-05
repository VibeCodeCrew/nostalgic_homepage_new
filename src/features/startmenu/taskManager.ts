// Диспетчер задач — порт TASK MANAGER (script.js:3608-3701).
// Вкладки «Приложения» (реальные окна wm) и «Процессы» (псевдо-таблица).

import { el, escapeHtml, xpIconHtml } from '../../core/dom';
import { wmCreate, wmClose, wmWindows, wmRestore, wmFocus, wmGet } from '../../wm/windowManager';

const FAKE_PROCS = [
    { name: 'System Idle Process', pid: 0,    mem: '24 КБ' },
    { name: 'System',              pid: 4,    mem: '244 КБ' },
    { name: 'explorer.exe',        pid: 1452, mem: '22 560 КБ' },
    { name: 'svchost.exe',         pid: 876,  mem: '4 428 КБ' },
    { name: 'svchost.exe',         pid: 944,  mem: '3 816 КБ' },
    { name: 'svchost.exe',         pid: 1024, mem: '7 240 КБ' },
    { name: 'lsass.exe',           pid: 672,  mem: '1 524 КБ' },
    { name: 'winlogon.exe',        pid: 624,  mem: '2 844 КБ' },
    { name: 'taskmgr.exe',         pid: 2048, mem: '3 976 КБ' },
];

export function openTaskManager(): void {
    if (wmWindows['taskmgr']) { wmRestore('taskmgr'); wmFocus('taskmgr'); return; }

    const c = el('div', { style: 'display:flex;flex-direction:column;height:100%;font-family:Tahoma,sans-serif;font-size:11px;' });

    // Табы
    const tabBar = el('div', { className: 'settings-tabs', style: 'margin:0 0 6px 0' });
    const tabs: Array<[string, string]> = [['apps', 'Приложения'], ['procs', 'Процессы']];
    const panels: Record<string, HTMLElement> = {};
    tabs.forEach(t => {
        const btn = el('div', { className: 'settings-tab' + (t[0] === 'apps' ? ' active' : ''), text: t[1], dataset: { tab: t[0] } });
        tabBar.appendChild(btn);
        panels[t[0]] = el('div', { className: 'settings-tab-content' + (t[0] === 'apps' ? ' active' : ''), style: 'flex:1;overflow-y:auto;' });
    });
    tabBar.addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.settings-tab');
        if (!btn) return;
        tabBar.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.keys(panels).forEach(k => panels[k].classList.remove('active'));
        panels[btn.dataset.tab!].classList.add('active');
    });

    // Вкладка «Приложения»
    const appsPanel = panels['apps'];
    appsPanel.style.cssText = 'flex:1;overflow-y:auto;padding:4px;';
    function refreshApps(): void {
        appsPanel.innerHTML = '';
        const tbl = el('table', { style: 'width:100%;border-collapse:collapse;' });
        tbl.innerHTML = '<tr style="background:#ECE9D8;font-weight:bold;"><td style="padding:3px 6px;border-bottom:1px solid #aca899;">Задача</td><td style="padding:3px 6px;border-bottom:1px solid #aca899;width:70px;">Статус</td><td style="padding:3px 6px;border-bottom:1px solid #aca899;width:80px;"></td></tr>';
        Object.keys(wmWindows).forEach(id => {
            const w = wmWindows[id];
            if (!w) return;
            const titleEl = w.el.querySelector('.xp-titlebar-title');
            const title = titleEl ? titleEl.textContent || '' : '(окно)';
            const tr = el('tr', { style: 'cursor:default' });
            tr.innerHTML = '<td style="padding:2px 6px;">' + escapeHtml(title) + '</td><td style="padding:2px 6px;color:#006600;">Работает</td><td style="padding:2px 6px;"></td>';
            const killBtn = el('button', { className: 'xp-dialog-btn', text: 'Снять', style: 'min-width:0;padding:1px 6px;height:18px;font-size:10px;' });
            killBtn.addEventListener('click', () => { wmClose(id); setTimeout(refreshApps, 150); });
            (tr.cells[2] as HTMLTableCellElement).appendChild(killBtn);
            tr.addEventListener('dblclick', () => { wmRestore(id); wmFocus(id); });
            tbl.appendChild(tr);
        });
        if (Object.keys(wmWindows).filter(k => k !== 'taskmgr').length === 0) {
            const tr = el('tr', {});
            tr.innerHTML = '<td colspan="3" style="padding:6px;color:#999;text-align:center;">Нет открытых окон</td>';
            tbl.appendChild(tr);
        }
        appsPanel.appendChild(tbl);
    }
    refreshApps();

    // Вкладка «Процессы»
    const procsPanel = panels['procs'];
    procsPanel.style.cssText = 'flex:1;overflow-y:auto;padding:4px;';
    const pTbl = el('table', { style: 'width:100%;border-collapse:collapse;' });
    let pHtml = '<tr style="background:#ECE9D8;font-weight:bold;"><td style="padding:3px 6px;border-bottom:1px solid #aca899;">Имя</td><td style="padding:3px 6px;border-bottom:1px solid #aca899;width:50px;">PID</td><td style="padding:3px 6px;border-bottom:1px solid #aca899;width:90px;">Память</td></tr>';
    FAKE_PROCS.forEach(p => {
        pHtml += '<tr><td style="padding:2px 6px;">' + p.name + '</td><td style="padding:2px 6px;">' + p.pid + '</td><td style="padding:2px 6px;">' + p.mem + '</td></tr>';
    });
    // Реальная память браузера, если доступна
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    if (perf.memory) {
        const mb = Math.round(perf.memory.usedJSHeapSize / 1048576);
        pHtml += '<tr style="background:#f8f8e0;"><td style="padding:2px 6px;">chrome.exe</td><td style="padding:2px 6px;">–</td><td style="padding:2px 6px;">' + mb + ' МБ</td></tr>';
    }
    pTbl.innerHTML = pHtml;
    procsPanel.appendChild(pTbl);

    // Статус-бар
    const statusBar = el('div', { style: 'display:flex;gap:16px;padding:4px 8px;background:#ECE9D8;border-top:1px solid #aca899;font-size:10px;color:#333;flex-shrink:0;' });
    function updateStatus(): void {
        const cnt = Object.keys(wmWindows).length;
        statusBar.textContent = 'Процессы: ' + (FAKE_PROCS.length + 1) + ' | Окон: ' + cnt + ' | ЦП: ' + (Math.floor(Math.random() * 8) + 1) + '%';
    }
    updateStatus();

    c.appendChild(tabBar);
    Object.values(panels).forEach(p => c.appendChild(p));
    c.appendChild(statusBar);

    wmCreate('taskmgr', 'Диспетчер задач', c, 520, 360, xpIconHtml('taskmgr', 16));
    const tmRefresh = setInterval(() => {
        if (!wmWindows['taskmgr']) { clearInterval(tmRefresh); return; }
        const activeTab = c.querySelector<HTMLElement>('.settings-tab.active');
        if (activeTab && activeTab.dataset.tab === 'apps') refreshApps();
        updateStatus();
    }, 2000);
    // ФИКС АУДИТА: гарантированная остановка интервала при закрытии окна
    const w = wmGet('taskmgr');
    if (w) w.onClose = () => clearInterval(tmRefresh);
}
