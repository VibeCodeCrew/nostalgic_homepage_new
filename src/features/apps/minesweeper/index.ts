// Сапёр — классический Minesweeper: поле, мины, флаги, смайлик, счётчик, таймер, уровни сложности.
// Порт MINESWEEPER (script.js:4550-4855).
// Фикс аудита: интервал таймера в оригинале НЕ очищался при закрытии окна —
// здесь очистка через wmGet('minesweeper').onClose.
// Реакции Clippy (первый клик, флаг, победа/поражение) — через emit('clippy-react').

import { xpIconHtml } from '../../../core/dom';
import { emit } from '../../../core/events';
import { minesweeperLosses, setMinesweeperLosses } from '../../../core/state';
import { registerAction, runAction } from '../../../core/actions';
import { wmCreate, wmGet, wmRestore, wmFocus } from '../../../wm/windowManager';

interface MinesDiff {
    label: string;
    R: number;
    C: number;
    M: number;
}

export function openMinesweeper(): void {
    if (wmGet('minesweeper')) { wmRestore('minesweeper'); wmFocus('minesweeper'); return; }

    const DIFFS: MinesDiff[] = [
        { label: 'Начинающий', R: 9,  C: 9,  M: 10 },
        { label: 'Средний',    R: 16, C: 16, M: 40 },
        { label: 'Эксперт',    R: 16, C: 30, M: 99 },
    ];
    let di = 0;
    let board: number[][] = [];
    let rev: boolean[][] = [];
    let flag: boolean[][] = [];
    let over = false;
    let won = false;
    let tint: number | undefined;
    let secs = 0;
    let first = true;

    const c = document.createElement('div');
    c.className = 'mines-window';
    wmCreate('minesweeper', 'Сапёр', c, 250, 370, xpIconHtml('minesweeper', 16));

    // Фикс аудита: таймер игры останавливаем при закрытии окна.
    const win = wmGet('minesweeper');
    if (win) {
        win.onClose = () => {
            if (tint !== undefined) clearInterval(tint);
        };
    }

    function getD(): MinesDiff { return DIFFS[di]; }

    function setCounter(n: number): void {
        const e = c.querySelector('#mines-counter');
        if (e) e.textContent = String(Math.max(0, n)).padStart(3, '0');
    }
    function setTimer(n: number): void {
        const e = c.querySelector('#mines-timer');
        if (e) e.textContent = String(Math.min(999, n)).padStart(3, '0');
    }

    function nb(r: number, cc: number, R: number, C: number, fn: (nr: number, nc: number) => void): void {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = cc + dc;
            if (nr >= 0 && nr < R && nc >= 0 && nc < C) fn(nr, nc);
        }
    }

    function place(ar: number, ac: number, R: number, C: number, M: number): void {
        let p = 0;
        while (p < M) {
            const r = Math.floor(Math.random() * R), cc = Math.floor(Math.random() * C);
            if (board[r][cc] !== -1 && !(r === ar && cc === ac)) { board[r][cc] = -1; p++; }
        }
        for (let r = 0; r < R; r++) for (let cc = 0; cc < C; cc++) {
            if (board[r][cc] === -1) continue;
            let n = 0;
            nb(r, cc, R, C, (nr, nc) => { if (board[nr][nc] === -1) n++; });
            board[r][cc] = n;
        }
    }

    function reveal(r: number, cc: number, R: number, C: number): void {
        if (rev[r][cc] || flag[r][cc]) return;
        rev[r][cc] = true;
        if (board[r][cc] === 0) nb(r, cc, R, C, (nr, nc) => { reveal(nr, nc, R, C); });
    }

    function countFlags(): number {
        let f = 0;
        flag.forEach(row => { row.forEach(v => { if (v) f++; }); });
        return f;
    }

    function checkWin(R: number, C: number): boolean {
        for (let r = 0; r < R; r++) for (let cc = 0; cc < C; cc++) if (board[r][cc] !== -1 && !rev[r][cc]) return false;
        return true;
    }

    function rend(R: number, C: number): void {
        const g = c.querySelector('#mines-grid');
        if (!g) return;
        let cells = Array.from(g.querySelectorAll<HTMLElement>('.mines-cell'));
        // Перестраиваем сетку только если изменилась размерность (смена сложности)
        if (cells.length !== R * C) {
            g.innerHTML = '';
            cells = [];
            for (let i = 0; i < R * C; i++) {
                const cell = document.createElement('div');
                cell.className = 'mines-cell';
                cells.push(cell);
                g.appendChild(cell);
            }
        }
        for (let r = 0; r < R; r++) for (let cc = 0; cc < C; cc++) {
            const cell = cells[r * C + cc];
            cell.dataset.r = String(r);
            cell.dataset.c = String(cc);
            cell.style.animationDelay = '';
            let cls = 'mines-cell';
            let txt = '';
            if (rev[r][cc]) {
                cls += ' revealed';
                if (board[r][cc] === -1) { cls += ' mine'; txt = '\uD83D\uDCA3'; }
                else if (board[r][cc] > 0) { txt = String(board[r][cc]); cls += ' num-' + board[r][cc]; }
            } else if (flag[r][cc]) { cls += ' flagged'; txt = '\uD83D\uDEA9'; }
            if (cell.className !== cls) cell.className = cls;
            if (cell.textContent !== txt) cell.textContent = txt;
        }
    }

    function snapshot2D(arr: boolean[][]): boolean[][] {
        return arr.map(row => row.slice());
    }

    function animateChanges(R: number, C: number, prevRev: boolean[][] | null, prevFlag: boolean[][] | null, opts?: { mineBoom?: boolean; boomDelay?: (r: number, cc: number) => number }): void {
        opts = opts || {};
        const cells = c.querySelectorAll<HTMLElement>('.mines-cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            const wasRev = !!(prevRev && prevRev[r] && prevRev[r][cc]);
            const wasFlag = !!(prevFlag && prevFlag[r] && prevFlag[r][cc]);
            const isRev = rev[r][cc];
            const isFlag = flag[r][cc];
            if (isRev && !wasRev) {
                cell.style.animationDelay = '';
                if (opts.mineBoom && board[r][cc] === -1) {
                    const delay = opts.boomDelay ? opts.boomDelay(r, cc) : 0;
                    cell.style.animationDelay = delay + 's';
                    cell.classList.add('mines-mine-boom');
                } else {
                    cell.classList.add('mines-reveal-anim');
                    setTimeout(() => { cell.classList.remove('mines-reveal-anim'); }, 200);
                }
            }
            if (isFlag && !wasFlag) {
                cell.style.animationDelay = '';
                cell.classList.add('mines-flag-anim');
                setTimeout(() => { cell.classList.remove('mines-flag-anim'); }, 250);
            }
        });
    }

    function animateWin(): void {
        const cells = c.querySelectorAll<HTMLElement>('.mines-cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            if (rev[r][cc] && board[r][cc] !== -1) {
                cell.style.animationDelay = '';
                cell.classList.add('mines-win-anim');
                setTimeout(() => { cell.classList.remove('mines-win-anim'); }, 1000);
            }
        });
        const sm = c.querySelector('#mines-smiley');
        if (sm) { sm.classList.remove('mines-smiley-bounce'); void (sm as HTMLElement).offsetWidth; sm.classList.add('mines-smiley-bounce'); }
    }

    function animateLoss(clickedR: number, clickedC: number): void {
        const cells = c.querySelectorAll<HTMLElement>('.mines-cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            if (rev[r][cc] && board[r][cc] === -1) {
                // Нажатая мина взрывается первой, остальные — с задержкой по расстоянию
                const dist = Math.abs(r - clickedR) + Math.abs(cc - clickedC);
                cell.style.animationDelay = (dist * 0.03) + 's';
                cell.classList.add('mines-mine-boom');
            }
        });
        const sm = c.querySelector('#mines-smiley');
        if (sm) { sm.classList.remove('mines-smiley-bounce'); void (sm as HTMLElement).offsetWidth; sm.classList.add('mines-smiley-bounce'); }
    }

    function animateAppear(R: number, C: number): void {
        const cells = c.querySelectorAll<HTMLElement>('.mines-cell');
        const maxDelay = (R * C - 1) * 0.002;
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            cell.style.animationDelay = ((r * C + cc) * 0.002) + 's';
            cell.classList.add('mines-appear');
        });
        setTimeout(() => {
            c.querySelectorAll<HTMLElement>('.mines-cell').forEach(cell => {
                cell.classList.remove('mines-appear');
                cell.style.animationDelay = '';
            });
        }, (maxDelay + 0.25) * 1000);
    }

    function start(): void {
        const { R, C, M } = getD();
        if (tint !== undefined) clearInterval(tint);
        secs = 0; over = false; won = false; first = true;
        board = Array.from({ length: R }, () => Array(C).fill(0));
        rev   = Array.from({ length: R }, () => Array(C).fill(false));
        flag  = Array.from({ length: R }, () => Array(C).fill(false));
        setCounter(M); setTimer(0);
        const sm = c.querySelector('#mines-smiley');
        if (sm) { sm.textContent = '\uD83D\uDE42'; sm.classList.remove('mines-smiley-bounce'); }
        rend(R, C);
        animateAppear(R, C);
    }

    function buildUI(): void {
        const { R, C, M } = getD();
        const CS = 22; // размер клетки в px
        const gridW = C * CS + 6; // клетки + inset-рамка 3px с обеих сторон
        const gridH = R * CS + 6;
        // Хром окна: тайтлбар ~32px + рамки окна 4px
        const chromeH = 36;
        // Внутренняя раскладка окна сапёра: padding 12 + gaps 8 + панель сложности 24 + шапка 52 + сетка
        const contentH = 12 + 8 + 24 + 52 + gridH;
        const winW = Math.max(240, gridW + 12 + 4 + 4); // сетка + padding + рамки окна + запас
        const winH = contentH + chromeH + 4;
        const w = wmGet('minesweeper');
        if (w) { w.el.style.width = winW + 'px'; w.el.style.height = winH + 'px'; }

        c.innerHTML =
            '<div class="mines-diff-bar">' +
            DIFFS.map((d, i) => '<button class="mines-diff-btn' + (i === di ? ' active' : '') + '" data-di="' + i + '">' + d.label + '</button>').join('') +
            '</div>' +
            '<div class="mines-header">' +
            '<div id="mines-counter" class="mines-lcd">' + String(M).padStart(3, '0') + '</div>' +
            '<button id="mines-smiley" class="mines-smiley">\uD83D\uDE42</button>' +
            '<div id="mines-timer" class="mines-lcd">000</div>' +
            '</div>' +
            '<div class="mines-grid-wrap">' +
            '<div id="mines-grid" class="mines-grid" style="grid-template-columns:repeat(' + C + ',' + CS + 'px)"></div>' +
            '</div>';

        c.querySelectorAll<HTMLElement>('.mines-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                di = parseInt(btn.dataset.di || '0', 10);
                buildUI();
                start();
            });
        });

        c.querySelector('#mines-smiley')!.addEventListener('click', () => { buildUI(); start(); });

        const grid = c.querySelector('#mines-grid')!;

        grid.addEventListener('click', (e: Event) => {
            const cell = (e.target as HTMLElement).closest('.mines-cell') as HTMLElement | null;
            if (!cell || over || won) return;
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            if (flag[r][cc] || rev[r][cc]) return;
            const prevRev = snapshot2D(rev);
            const prevFlag = snapshot2D(flag);
            if (first) {
                first = false;
                place(r, cc, R, C, M);
                tint = setInterval(() => { secs++; setTimer(secs); }, 1000);
                // E1: первый клик по полю
                emit('clippy-react', { category: 'react_mines_firstclick', anim: 'think', duration: 4000, delay: 300 });
            }
            if (board[r][cc] === -1) {
                over = true;
                rev[r][cc] = true;
                if (tint !== undefined) clearInterval(tint);
                for (let rr = 0; rr < R; rr++) for (let ccc = 0; ccc < C; ccc++) if (board[rr][ccc] === -1) rev[rr][ccc] = true;
                rend(R, C);
                animateLoss(r, cc);
                const sm = c.querySelector('#mines-smiley');
                if (sm) sm.textContent = '\uD83D\uDE35';
                setMinesweeperLosses(minesweeperLosses + 1);
                // E3: два поражения подряд — отдельная реплика
                if (minesweeperLosses === 2) {
                    emit('clippy-react', { category: 'react_mines_second_loss', anim: 'sad', delay: 500 });
                } else {
                    emit('clippy-react', { category: 'react_minesweeper_loss', anim: 'sad', delay: 500 });
                }
                // Третье поражение подряд — BSOD (действие регистрирует фича BSOD)
                if (minesweeperLosses >= 3) { setTimeout(() => { runAction('bsod'); }, 1500); }
                return;
            }
            reveal(r, cc, R, C);
            rend(R, C);
            animateChanges(R, C, prevRev, prevFlag);
            if (checkWin(R, C)) {
                won = true;
                if (tint !== undefined) clearInterval(tint);
                setMinesweeperLosses(0);
                const sm = c.querySelector('#mines-smiley');
                if (sm) { sm.textContent = '\uD83D\uDE0E'; sm.classList.remove('mines-smiley-bounce'); void (sm as HTMLElement).offsetWidth; sm.classList.add('mines-smiley-bounce'); }
                animateWin();
                emit('clippy-react', { category: 'react_minesweeper_win', anim: 'excited', delay: 500 });
            }
        });

        // Правая кнопка: флаг (блокируем контекстное меню браузера)
        grid.addEventListener('contextmenu', (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            const cell = (e.target as HTMLElement).closest('.mines-cell') as HTMLElement | null;
            if (!cell || over || won) return;
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            if (rev[r][cc]) return;
            flag[r][cc] = !flag[r][cc];
            setCounter(M - countFlags());
            // Обновляем только эту клетку, не перестраивая всю сетку
            cell.className = 'mines-cell';
            cell.textContent = '';
            cell.style.animationDelay = '';
            if (flag[r][cc]) {
                cell.classList.add('flagged');
                cell.textContent = '\uD83D\uDEA9';
                cell.classList.add('mines-flag-anim');
                setTimeout(() => { cell.classList.remove('mines-flag-anim'); }, 200);
            }
            // E2: реакция на установку флага (30% шанс, как в оригинале)
            if (flag[r][cc] && Math.random() < 0.3) {
                emit('clippy-react', { category: 'react_mines_flag', anim: 'wave', duration: 3500, delay: 200 });
            }
        });

        // Средняя кнопка: chord (открыть соседей, если число флагов совпадает с цифрой)
        grid.addEventListener('mousedown', (e: Event) => {
            const me = e as MouseEvent;
            if (me.button !== 1) return;
            me.preventDefault();
            const cell = (me.target as HTMLElement).closest('.mines-cell') as HTMLElement | null;
            if (!cell || over || won) return;
            const r = parseInt(cell.dataset.r || '0', 10), cc = parseInt(cell.dataset.c || '0', 10);
            if (!rev[r][cc] || board[r][cc] <= 0) return;
            let adjFlags = 0;
            nb(r, cc, R, C, (nr, nc) => { if (flag[nr][nc]) adjFlags++; });
            if (adjFlags !== board[r][cc]) return;
            const prevRev = snapshot2D(rev);
            let boom = false;
            nb(r, cc, R, C, (nr, nc) => {
                if (!rev[nr][nc] && !flag[nr][nc]) {
                    if (board[nr][nc] === -1) { boom = true; rev[nr][nc] = true; }
                    else reveal(nr, nc, R, C);
                }
            });
            if (boom) {
                over = true;
                if (tint !== undefined) clearInterval(tint);
                for (let rr = 0; rr < R; rr++) for (let ccc = 0; ccc < C; ccc++) if (board[rr][ccc] === -1) rev[rr][ccc] = true;
                rend(R, C);
                animateLoss(r, cc);
                const sm = c.querySelector('#mines-smiley');
                if (sm) sm.textContent = '\uD83D\uDE35';
                setMinesweeperLosses(minesweeperLosses + 1);
                emit('clippy-react', { category: 'react_minesweeper_loss', anim: 'sad', delay: 500 });
                if (minesweeperLosses >= 3) { setTimeout(() => { runAction('bsod'); }, 1500); }
            } else {
                rend(R, C);
                animateChanges(R, C, prevRev, null);
                if (checkWin(R, C)) {
                    won = true;
                    if (tint !== undefined) clearInterval(tint);
                    setMinesweeperLosses(0);
                    const sm = c.querySelector('#mines-smiley');
                    if (sm) { sm.textContent = '\uD83D\uDE0E'; sm.classList.remove('mines-smiley-bounce'); void (sm as HTMLElement).offsetWidth; sm.classList.add('mines-smiley-bounce'); }
                    animateWin();
                    emit('clippy-react', { category: 'react_minesweeper_win', anim: 'excited', delay: 500 });
                }
            }
        });

        start();
    }

    setTimeout(() => { buildUI(); }, 0);
}

export function initMinesweeper(): void {
    registerAction('app:minesweeper', openMinesweeper);
}
