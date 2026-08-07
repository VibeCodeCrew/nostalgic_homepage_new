// Синий экран смерти (пасхалка): 8 с BSOD → экран загрузки XP → звук запуска.
// Порт блока BSOD из оригинала (script.js:441-527), паритет 1:1.
// Разметка и стили — через inline cssText, как в оригинале.

import { playSound } from '../../core/sound';
import { setMinesweeperLosses } from '../../core/state';
import { registerAction } from '../../core/actions';
import { emit } from '../../core/events';

export function triggerBSOD(): void {
    const bsod = document.createElement('div');
    bsod.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#0000aa;color:#fff;font-family:"Lucida Console","Courier New",monospace;font-size:14px;line-height:1.6;z-index:99999;padding:48px 60px;box-sizing:border-box;white-space:pre-wrap;';
    bsod.textContent = [
        'A problem has been detected and Windows has been shut down to prevent damage',
        'to your computer.',
        '',
        'IRQL_NOT_LESS_OR_EQUAL',
        '',
        'If this is the first time you\'ve seen this Stop error screen,',
        'restart your computer. If this screen appears again, follow',
        'these steps:',
        '',
        'Check to make sure any new hardware or software is properly installed.',
        'If this is a new installation, ask your hardware or software manufacturer',
        'for any Windows updates you might need.',
        '',
        'If problems continue, disable or remove any newly installed hardware',
        'or software. Disable BIOS memory options such as caching or shadowing.',
        'If you need to use Safe Mode to remove or disable components, restart',
        'your computer, press F8 to select Advanced Startup Options, and',
        'then select Safe Mode.',
        '',
        'Technical information:',
        '',
        '*** STOP: 0x0000000A (0x00000000, 0x00000002, 0x00000001, 0x804E5BD5)',
        '',
        'Beginning dump of physical memory',
        'Physical memory dump complete.',
        'Contact your system administrator or technical support group for further',
        'assistance.',
    ].join('\n');
    document.body.appendChild(bsod);
    playSound('error');
    setMinesweeperLosses(0);
    // После BSOD — экран загрузки XP, затем звук запуска
    setTimeout(() => {
        bsod.style.transition = 'opacity 0.3s';
        bsod.style.opacity = '0';
        setTimeout(() => {
            bsod.remove();
            emit('bsod-ended'); // реакция Clippy (react_bsod) — подписка в features/clippy
            showXPBoot(() => {
                playSound('startup');
            });
        }, 300);
    }, 8000);
}

export function showXPBoot(onDone?: () => void): void {
    const boot = document.createElement('div');
    boot.id = 'xp-boot-screen';
    boot.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    boot.innerHTML =
        '<div style="display:flex;align-items:center;gap:18px;margin-bottom:40px;">' +
        '<svg width="48" height="48" viewBox="0 0 48 48"><rect x="0" y="0" width="22" height="22" fill="#f35325"/><rect x="26" y="0" width="22" height="22" fill="#81bc06"/><rect x="0" y="26" width="22" height="22" fill="#05a6f0"/><rect x="26" y="26" width="22" height="22" fill="#ffba08"/></svg>' +
        '<div><div style="color:#fff;font-family:\'Franklin Gothic Medium\',\'Arial Narrow\',Arial,sans-serif;font-size:36px;font-weight:300;letter-spacing:1px;">Windows<span style="font-style:italic;"> XP</span></div>' +
        '<div style="color:#ccc;font-family:Tahoma,sans-serif;font-size:11px;letter-spacing:2px;">Professional</div></div>' +
        '</div>' +
        '<div id="xp-boot-bar" style="width:180px;height:14px;background:#111;border:1px solid #333;border-radius:2px;overflow:hidden;position:relative;">' +
        '<div id="xp-boot-progress" style="height:100%;width:0;background:linear-gradient(180deg,#3a8cf4 0%,#0555ee 100%);transition:none;"></div>' +
        '</div>' +
        '<div style="color:#aaa;font-family:Tahoma,sans-serif;font-size:10px;margin-top:10px;">Microsoft Corporation</div>';
    document.body.appendChild(boot);

    // Анимация progress bar — блоки двигаются слева направо как в XP
    let step = 0;
    const totalSteps = 18;
    const barEl = boot.querySelector<HTMLElement>('#xp-boot-progress')!;
    const barTimer = setInterval(() => {
        step++;
        // Бегущий блок: ширина растёт равномерно до 100%
        const pos = (step / totalSteps) * 100;
        barEl.style.width = Math.min(pos, 100) + '%';
        if (step >= totalSteps) clearInterval(barTimer);
    }, 160);

    setTimeout(() => {
        clearInterval(barTimer);
        boot.style.transition = 'opacity 0.5s';
        boot.style.opacity = '0';
        if (onDone) onDone();
        setTimeout(() => { boot.remove(); }, 500);
    }, totalSteps * 160 + 400);
}

export function initBsod(): void {
    registerAction('bsod', triggerBSOD);

    // Пасхалка: 5 быстрых кликов по цифрам часов = BSOD (порт script.js:8544-8557)
    let clockClicks = 0;
    let clockTimer: ReturnType<typeof setTimeout> | null = null;
    const trayTime = document.getElementById('tray-time');
    if (trayTime) {
        trayTime.style.cursor = 'default';
        trayTime.addEventListener('click', e => {
            e.stopPropagation(); // не триггерим toggleCalendar
            clockClicks++;
            if (clockTimer !== null) clearTimeout(clockTimer);
            if (clockClicks >= 5) { clockClicks = 0; triggerBSOD(); return; }
            clockTimer = setTimeout(() => { clockClicks = 0; }, 1000);
        });
    }
}
