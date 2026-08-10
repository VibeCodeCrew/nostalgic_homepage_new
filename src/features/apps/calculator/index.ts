// Калькулятор в XP-стиле: обычный/инженерный режимы, меню Вид/Правка/Справка.
// Порт CALCULATOR (script.js:4442-4549).
// Стили — в src/styles/apps.css (перенесены глобально, здесь не дублируются).

import { el, xpIconHtml } from '../../../core/dom';
import { emit } from '../../../core/events';
import { registerAction } from '../../../core/actions';
import { wmCreate, wmGet, wmRestore, wmFocus, wmResizeToContent, wmWindows } from '../../../wm/windowManager';

interface CalcState {
    disp: string;
    prev: number | null;
    op: string | null;
    waitOp: boolean;
    mem: number;
}

export function openCalculator(): void {
    if (wmWindows['calculator']) { wmRestore('calculator'); wmFocus('calculator'); return; }
    const c = el('div', { className: 'calc-window' });
    let scientific = false;
    const menuEdit = '<div class="calc-menu"><span class="calc-menu-label">Правка</span><div class="calc-menu-dropdown"><div class="calc-menu-item" data-cmd="copy">Копировать</div><div class="calc-menu-item" data-cmd="paste">Вставить</div></div></div>';
    const menuView = '<div class="calc-menu"><span class="calc-menu-label">Вид</span><div class="calc-menu-dropdown"><div class="calc-menu-item" data-cmd="standard">Обычный</div><div class="calc-menu-item" data-cmd="scientific">Инженерный</div></div></div>';
    const menuHelp = '<div class="calc-menu"><span class="calc-menu-label">Справка</span><div class="calc-menu-dropdown"><div class="calc-menu-item" data-cmd="about">О программе</div></div></div>';
    const standardPad =
        '<div class="calc-blank"></div><button class="calc-btn calc-fn" data-fn="back" style="grid-column:span 2">←</button><button class="calc-btn calc-fn" data-fn="ce">CE</button><button class="calc-btn calc-fn" data-fn="c">C</button><div class="calc-blank"></div>' +
        '<button class="calc-btn calc-mem" data-fn="mc">MC</button><button class="calc-btn calc-num" data-d="7">7</button><button class="calc-btn calc-num" data-d="8">8</button><button class="calc-btn calc-num" data-d="9">9</button><button class="calc-btn calc-op" data-op="/">/</button><button class="calc-btn calc-op" data-fn="sqrt">√</button>' +
        '<button class="calc-btn calc-mem" data-fn="mr">MR</button><button class="calc-btn calc-num" data-d="4">4</button><button class="calc-btn calc-num" data-d="5">5</button><button class="calc-btn calc-num" data-d="6">6</button><button class="calc-btn calc-op" data-op="*">*</button><button class="calc-btn calc-op" data-fn="pct">%</button>' +
        '<button class="calc-btn calc-mem" data-fn="ms">MS</button><button class="calc-btn calc-num" data-d="1">1</button><button class="calc-btn calc-num" data-d="2">2</button><button class="calc-btn calc-num" data-d="3">3</button><button class="calc-btn calc-op" data-op="-">−</button><button class="calc-btn calc-op" data-fn="inv">1/x</button>' +
        '<button class="calc-btn calc-mem" data-fn="m+">M+</button><button class="calc-btn calc-num" data-d="0">0</button><button class="calc-btn calc-op" data-fn="neg">+/-</button><button class="calc-btn calc-num" data-fn="dot">.</button><button class="calc-btn calc-op" data-op="+">+</button><button class="calc-btn calc-eq" data-fn="eq">=</button>';
    const scientificPad =
        '<button class="calc-btn calc-sci" data-fn="sin">sin</button><button class="calc-btn calc-sci" data-fn="cos">cos</button>' +
        '<button class="calc-btn calc-sci" data-fn="tan">tan</button><button class="calc-btn calc-sci" data-fn="log">log</button>' +
        '<button class="calc-btn calc-sci" data-fn="ln">ln</button><button class="calc-btn calc-sci" data-fn="sqr">x²</button>' +
        '<button class="calc-btn calc-sci" data-fn="pi">π</button><button class="calc-btn calc-sci" data-fn="fact">n!</button>' +
        '<button class="calc-btn calc-sci" data-fn="pow">x^y</button><div class="calc-blank"></div>';
    c.innerHTML = '<div class="calc-menubar">' + menuEdit + menuView + menuHelp + '</div>' +
        '<div class="calc-display"><input type="text" id="calc-screen" value="0" readonly></div>' +
        '<div class="calc-pad">' +
        '<div class="calc-buttons calc-standard">' + standardPad + '</div>' +
        '<div class="calc-buttons calc-scientific" style="display:none">' + scientificPad + '</div>' +
        '</div>';

    // Константы размеров (как в оригинале)
    const STD_COLS = 6, SCI_COLS = 2, ROWS = 5;
    const BTN_W = 36, BTN_H = 32, GAP = 4, PAD = 8, DISP_H = 40, MENU_H = 22, GAP_DISP = 6;
    function stdContentW(): number { return PAD + STD_COLS * BTN_W + (STD_COLS - 1) * GAP + PAD; }
    function sciContentW(): number { return stdContentW() + GAP + SCI_COLS * BTN_W + (SCI_COLS - 1) * GAP; }
    const contentH = PAD + MENU_H + GAP_DISP + DISP_H + GAP_DISP + ROWS * BTN_H + (ROWS - 1) * GAP + PAD;
    wmCreate('calculator', 'Калькулятор', c, stdContentW(), contentH, xpIconHtml('calculator', 16));
    setTimeout(() => { wmResizeToContent('calculator', stdContentW(), contentH, 200, 200); }, 0);

    const cs: CalcState = { disp: '0', prev: null, op: null, waitOp: false, mem: 0 };
    function fmt(n: number): string { const s = String(parseFloat(n.toFixed(10))); return s.length > 14 ? n.toExponential(6) : s; }
    function calc(a: number, b: number, op: string): number {
        if (op === '+') return a + b;
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '/') return b !== 0 ? a / b : 0;
        if (op === 'pow') return Math.pow(a, b);
        return b;
    }
    function upd(): void { const s = document.getElementById('calc-screen') as HTMLInputElement | null; if (s) s.value = cs.disp; }
    function fact(n: number): number { if (n < 0 || n !== Math.floor(n)) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
    function doSci(fn: string): void {
        const v = parseFloat(cs.disp);
        switch (fn) {
            case 'sin': cs.disp = fmt(Math.sin(v * Math.PI / 180)); break;
            case 'cos': cs.disp = fmt(Math.cos(v * Math.PI / 180)); break;
            case 'tan': cs.disp = fmt(Math.tan(v * Math.PI / 180)); break;
            case 'log': cs.disp = fmt(Math.log10(v)); break;
            case 'ln': cs.disp = fmt(Math.log(v)); break;
            case 'sqr': cs.disp = fmt(v * v); break;
            case 'pi': cs.disp = fmt(Math.PI); cs.waitOp = true; break;
            case 'fact': cs.disp = fmt(fact(v)); break;
        }
    }
    function setMode(isSci: boolean): void {
        scientific = isSci;
        const sciGrid = c.querySelector<HTMLElement>('.calc-scientific');
        const stdGrid = c.querySelector<HTMLElement>('.calc-standard');
        if (!sciGrid || !stdGrid) return;
        sciGrid.style.display = isSci ? 'grid' : 'none';
        const targetW = isSci ? sciContentW() : stdContentW();
        wmResizeToContent('calculator', targetW, contentH, 200, 200);
    }

    setTimeout(() => {
        const win = document.getElementById('win-calculator');
        if (!win) return;
        // Обработка меню
        win.querySelectorAll('.calc-menu-label').forEach(lbl => {
            lbl.addEventListener('click', e => {
                e.stopPropagation();
                const parent = lbl.parentNode as HTMLElement;
                const wasActive = parent.classList.contains('active');
                win.querySelectorAll('.calc-menu').forEach(m => { m.classList.remove('active'); });
                if (!wasActive) parent.classList.add('active');
            });
        });
        const onDocClick = (): void => {
            win.querySelectorAll('.calc-menu').forEach(m => { m.classList.remove('active'); });
        };
        document.addEventListener('click', onDocClick);
        // Фикс утечки: глобальный слушатель снимаем при закрытии окна
        const w = wmGet('calculator');
        if (w) {
            w.onClose = () => { document.removeEventListener('click', onDocClick); };
        }
        win.querySelectorAll('.calc-menu-item').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                const cmd = (item as HTMLElement).dataset.cmd;
                if (cmd === 'copy') { navigator.clipboard.writeText(cs.disp).catch(() => { /* ignore */ }); }
                else if (cmd === 'paste') {
                    navigator.clipboard.readText().then(t => {
                        const n = parseFloat(t);
                        if (!isNaN(n)) { cs.disp = fmt(n); cs.waitOp = false; upd(); }
                    }).catch(() => { /* ignore */ });
                }
                else if (cmd === 'standard') { setMode(false); }
                else if (cmd === 'scientific') { setMode(true); }
                else if (cmd === 'about') { alert('Калькулятор\nВерсия 1.0\nNostalgic Startpage'); }
                win.querySelectorAll('.calc-menu').forEach(m => { m.classList.remove('active'); });
            });
        });

        // Обработка кнопок
        const pad = c.querySelector('.calc-pad');
        if (!pad) return;
        pad.addEventListener('click', e => {
            const btn = (e.target as HTMLElement).closest('.calc-btn') as HTMLElement | null;
            if (!btn) return;
            if (btn.dataset.d !== undefined) {
                if (cs.waitOp) { cs.disp = btn.dataset.d; cs.waitOp = false; }
                else cs.disp = cs.disp === '0' ? btn.dataset.d : cs.disp + btn.dataset.d;
                if (cs.disp.length > 14) cs.disp = cs.disp.slice(0, 14);
            } else if (btn.dataset.op) {
                const v = parseFloat(cs.disp);
                if (cs.op && !cs.waitOp) { const r = calc(cs.prev ?? 0, v, cs.op); cs.disp = fmt(r); cs.prev = r; }
                else cs.prev = v;
                cs.op = btn.dataset.op;
                cs.waitOp = true;
            } else if (btn.dataset.fn) {
                const v = parseFloat(cs.disp);
                switch (btn.dataset.fn) {
                    case 'dot': if (!cs.disp.includes('.')) cs.disp += '.'; break;
                    case 'eq': if (cs.op && !cs.waitOp) {
                        const isDivZero = cs.op === '/' && v === 0;
                        const calcRes = calc(cs.prev ?? 0, v, cs.op);
                        cs.disp = fmt(calcRes);
                        cs.op = null; cs.prev = null; cs.waitOp = false;
                        // Реакции Скрепки на результат (порядок else-if — как в оригинале)
                        if (isDivZero) emit('clippy-react', { category: 'react_calc_divzero', anim: 'alert', duration: 5000, delay: 100 });
                        else if (calcRes >= 1000000) emit('clippy-react', { category: 'react_calc_million', anim: 'excited', duration: 5000, delay: 100 });
                        else if (calcRes === 42) emit('clippy-react', { category: 'react_calc_42', anim: 'wave', duration: 6000, delay: 100 });
                    } break;
                    case 'c': { const mem = cs.mem; cs.disp = '0'; cs.prev = null; cs.op = null; cs.waitOp = false; cs.mem = mem; break; }
                    case 'ce': cs.disp = '0'; break;
                    case 'back': cs.disp = cs.disp.length > 1 ? cs.disp.slice(0, -1) : '0'; break;
                    case 'ms': cs.mem = v; break;
                    case 'mr': cs.disp = fmt(cs.mem); break;
                    case 'mc': cs.mem = 0; break;
                    case 'm+': cs.mem += v; break;
                    case 'sqrt': cs.disp = fmt(Math.sqrt(v)); break;
                    case 'pct': cs.disp = fmt(v / 100); break;
                    case 'inv': cs.disp = fmt(v !== 0 ? 1 / v : 0); break;
                    case 'neg': cs.disp = fmt(-v); break;
                    default: doSci(btn.dataset.fn);
                }
            }
            upd();
        });
    }, 0);
}

export function initCalculator(): void {
    registerAction('app:calculator', openCalculator);
}
