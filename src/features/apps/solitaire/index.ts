// Косынка (Solitaire / Klondike): колода, стопки, drag карт, счёт, новая игра,
// легендарная анимация победы.
// Порт SOLITAIRE (script.js:5187-5567).
// Фикс аудита: document-слушатели drag (mousemove/mouseup) снимаются не только
// на mouseup, но и при закрытии окна (wmGet('solitaire').onClose) — иначе
// «призрак» карты и слушатели оставались жить после закрытия окна mid-drag.
// Клик-реакции Clippy из оригинала не портируются.

import './solitaire.css';
import { xpIconHtml } from '../../../core/dom';
import { registerAction } from '../../../core/actions';
import { emit } from '../../../core/events';
import { wmCreate, wmGet, wmRestore, wmFocus } from '../../../wm/windowManager';

interface SolCard {
    s: string;    // масть ♠♥♦♣
    v: string;    // достоинство A..K
    face: boolean;
}

type DragSrcType = 'waste' | 'tableau';

interface DragSrc {
    card: SolCard;
    src: DragSrcType;
    idx: number;
    rowIdx?: number;
}

export function openSolitaire(): void {
    if (wmGet('solitaire')) { wmRestore('solitaire'); wmFocus('solitaire'); return; }
    const c = document.createElement('div');
    c.className = 'solitaire-window';
    c.innerHTML = '<div class="sol-toolbar"><button id="sol-new" class="xp-dialog-btn">Новая игра</button><span id="sol-score" style="margin-left:12px;font-size:11px;color:#333">Счёт: 0</span></div><div id="sol-area" class="sol-area"></div>';
    // Размер окна — под полный tableau (до 13 карт в колонке) без скроллбаров
    const CARD_W = 68, CARD_H = 96, COLS = 7, GAP = 8, PAD = 16, OVERLAP = 16, TOOLBAR_H = 30;
    const contentW = PAD + COLS * CARD_W + (COLS - 1) * GAP + PAD;
    const maxTabH = CARD_H + (13 - 1) * OVERLAP;
    const contentH = PAD + TOOLBAR_H + GAP + CARD_H + GAP + maxTabH + PAD;
    wmCreate('solitaire', 'Косынка', c, contentW, contentH, xpIconHtml('solitaire', 16));
    setTimeout(() => { initSolitaireGame(); }, 0);
}

function initSolitaireGame(): void {
    const SOL_SUITS = ['♠', '♥', '♦', '♣'];
    const SOL_VALS  = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const SOL_RED   = new Set(['♥', '♦']);

    let deck: SolCard[] = [];
    let tableau: SolCard[][] = [];
    let foundations: SolCard[][] = [];
    let stock: SolCard[] = [];
    let waste: SolCard[] = [];
    let score = 0;
    let dragSrc: DragSrc | null = null;

    // Счётчики для реакций Clippy: первый ход и «пат» (10+ ходов без хода в дом)
    let solFirstMove = true, solMoveCount = 0, solFoundMoves = 0;

    // Активные drag-сессии: чистятся на mouseup и при закрытии окна (фикс аудита)
    const dragCleanups = new Set<() => void>();

    const win = wmGet('solitaire');
    if (win) {
        win.onClose = () => {
            dragCleanups.forEach(fn => { fn(); });
            dragCleanups.clear();
        };
    }

    function newDeck(): SolCard[] {
        const d: SolCard[] = [];
        SOL_SUITS.forEach(s => { SOL_VALS.forEach(v => { d.push({ s: s, v: v, face: false }); }); });
        for (let i = d.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [d[i], d[j]] = [d[j], d[i]];
        }
        return d;
    }
    function valIdx(v: string): number { return SOL_VALS.indexOf(v); }
    function isRed(s: string): boolean { return SOL_RED.has(s); }

    function startGame(): void {
        deck        = newDeck();
        tableau     = Array.from({ length: 7 }, () => [] as SolCard[]);
        foundations = Array.from({ length: 4 }, () => [] as SolCard[]);
        stock = []; waste = []; score = 0;
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) { tableau[j].push(deck.pop()!); }
            tableau[i][i].face = true;
        }
        stock = deck.splice(0);
        stock.forEach(card => { card.face = false; });
        render();
    }

    function render(): void {
        const area = document.getElementById('sol-area');
        if (!area) return;
        area.innerHTML = '';
        // Счёт
        const sc = document.getElementById('sol-score');
        if (sc) sc.textContent = 'Счёт: ' + score;

        // Верхний ряд: колода + сброс + дома
        const topRow = document.createElement('div');
        topRow.className = 'sol-top-row';

        // Колода
        const stockEl = document.createElement('div');
        stockEl.className = 'sol-stock sol-card-place';
        stockEl.textContent = stock.length ? '🂠' : '↺';
        stockEl.style.cursor = 'pointer';
        stockEl.addEventListener('click', () => {
            if (stock.length) {
                const card = stock.pop()!;
                card.face = true;
                waste.push(card);
                score = Math.max(0, score - 2);
            } else {
                stock = waste.reverse();
                waste = [];
                stock.forEach(card => { card.face = false; });
            }
            render();
        });
        topRow.appendChild(stockEl);

        // Сброс
        const wasteEl = document.createElement('div');
        wasteEl.className = 'sol-waste sol-card-place';
        if (waste.length) {
            const top = waste[waste.length - 1];
            wasteEl.appendChild(makeCard(top, true));
            makeDraggable(wasteEl, top, 'waste', waste.length - 1);
        }
        topRow.appendChild(wasteEl);

        // Распорка
        topRow.appendChild(document.createElement('div'));

        // Дома
        foundations.forEach((f, fi) => {
            const fe = document.createElement('div');
            fe.className = 'sol-foundation sol-card-place';
            fe.dataset.fi = String(fi);
            fe.textContent = f.length ? '' : SOL_SUITS[fi];
            if (f.length) fe.appendChild(makeCard(f[f.length - 1], true));
            topRow.appendChild(fe);
        });

        area.appendChild(topRow);

        // Tableau
        const tabRow = document.createElement('div');
        tabRow.className = 'sol-tab-row';
        tableau.forEach((col, ci) => {
            const colEl = document.createElement('div');
            colEl.className = 'sol-col';
            colEl.dataset.ci = String(ci);

            if (!col.length) {
                const empty = document.createElement('div');
                empty.className = 'sol-card-place sol-empty-col';
                colEl.appendChild(empty);
            }
            col.forEach((card, ri) => {
                const cardEl = makeCard(card, card.face);
                cardEl.style.position = 'relative';
                cardEl.style.marginTop = ri === 0 ? '0' : '-80px';
                if (card.face && ri < col.length) {
                    cardEl.style.zIndex = String(ri + 1);
                }
                if (card.face) makeDraggable(cardEl, card, 'tableau', ci, ri);
                colEl.appendChild(cardEl);
            });
            tabRow.appendChild(colEl);
        });
        area.appendChild(tabRow);

        // Проверка победы
        if (foundations.every(f => f.length === 13)) {
            score += 500;
            const sc2 = document.getElementById('sol-score');
            if (sc2) sc2.textContent = 'Счёт: ' + score;
            emit('clippy-react', { category: 'react_solitaire_win', anim: 'excited', delay: 500 });
            startWinAnimation();
        }
    }

    // --- ЛЕГЕНДАРНАЯ АНИМАЦИЯ ПОБЕДЫ ---
    function startWinAnimation(): void {
        const area = document.getElementById('sol-area');
        if (!area) return;

        const cv = document.createElement('canvas');
        cv.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:100; cursor:pointer;';
        cv.width = area.offsetWidth;
        cv.height = area.offsetHeight;
        area.appendChild(cv);
        const ctx = cv.getContext('2d');
        if (!ctx) return;

        cv.addEventListener('click', () => {
            cv.remove();
            startGame();
        });

        const CW = 68, CH = 96;
        const deckToDrop: { card: SolCard; x: number; y: number }[] = [];

        const foundationEls = area.querySelectorAll('.sol-foundation');
        foundations.forEach((f, i) => {
            if (!foundationEls[i]) return;
            const rect = foundationEls[i].getBoundingClientRect();
            const areaRect = area.getBoundingClientRect();
            const startX = rect.left - areaRect.left + area.scrollLeft;
            const startY = rect.top - areaRect.top + area.scrollTop;
            for (let j = f.length - 1; j >= 0; j--) {
                deckToDrop.push({ card: f[j], x: startX, y: startY });
            }
        });

        let currentCard: { card: SolCard; x: number; y: number; vx: number; vy: number } | null = null;
        let cardTimer = 0;

        function drawCard(card: SolCard, x: number, y: number): void {
            ctx!.fillStyle = '#fff';
            ctx!.fillRect(x, y, CW, CH);
            ctx!.strokeStyle = '#bbb';
            ctx!.strokeRect(x, y, CW, CH);
            ctx!.fillStyle = (card.s === '♥' || card.s === '♦') ? '#cc0000' : '#000';
            ctx!.font = 'bold 13px Tahoma';
            ctx!.textAlign = 'left';
            ctx!.fillText(card.v + card.s, x + 4, y + 14);
            ctx!.save();
            ctx!.translate(x + CW, y + CH);
            ctx!.rotate(Math.PI);
            ctx!.fillText(card.v + card.s, 4, 14);
            ctx!.restore();
        }

        function loop(): void {
            if (!document.body.contains(cv)) return;

            // Намеренно НЕ очищаем канвас — создаём шлейф как в оригинальном XP
            if (cardTimer <= 0 && deckToDrop.length > 0) {
                const next = deckToDrop.pop()!;
                currentCard = {
                    card: next.card,
                    x: next.x, y: next.y,
                    vx: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2),
                    vy: Math.random() * -3 - 2
                };
                cardTimer = 40;
            }
            cardTimer--;

            if (currentCard) {
                currentCard.vy += 0.6;
                currentCard.x += currentCard.vx;
                currentCard.y += currentCard.vy;

                if (currentCard.y + CH > cv.height) {
                    currentCard.y = cv.height - CH;
                    currentCard.vy = -currentCard.vy * 0.82;
                }
                if (currentCard.x < 0) {
                    currentCard.x = 0; currentCard.vx = -currentCard.vx;
                } else if (currentCard.x + CW > cv.width) {
                    currentCard.x = cv.width - CW; currentCard.vx = -currentCard.vx;
                }

                drawCard(currentCard.card, currentCard.x, currentCard.y);
            }

            if (deckToDrop.length === 0 && cardTimer < -150) {
                ctx!.fillStyle = 'rgba(0, 107, 0, 0.9)';
                ctx!.fillRect(cv.width / 2 - 110, cv.height / 2 - 20, 220, 40);
                ctx!.fillStyle = '#fff';
                ctx!.font = 'bold 12px Tahoma';
                ctx!.textAlign = 'center';
                ctx!.fillText('Кликните для новой игры', cv.width / 2, cv.height / 2 + 4);
                return;
            }

            requestAnimationFrame(loop);
        }
        loop();
    }

    function makeCard(card: SolCard, faceUp: boolean): HTMLElement {
        const cardEl = document.createElement('div');
        cardEl.className = 'sol-card' + (faceUp ? (isRed(card.s) ? ' sol-red' : ' sol-black') : ' sol-back');
        if (faceUp) {
            // Значения карт — внутренние константы колоды, экранирование не требуется
            cardEl.innerHTML = '<span class="sol-val-top">' + card.v + card.s + '</span><span class="sol-val-bot">' + card.v + card.s + '</span>';
        }
        return cardEl;
    }

    function makeDraggable(cardEl: HTMLElement, card: SolCard, src: DragSrcType, idx: number, rowIdx?: number): void {
        // Автоматический перенос в Дом по двойному клику
        cardEl.addEventListener('dblclick', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (src === 'tableau' && rowIdx !== tableau[idx].length - 1) return; // Только нижнюю карту из колонки
            for (let fi = 0; fi < 4; fi++) {
                const f = foundations[fi];
                const topCard = f.length ? f[f.length - 1] : null;
                const canPlace = (!topCard && card.v === 'A') || (topCard !== null && topCard.s === card.s && valIdx(card.v) === valIdx(topCard.v) + 1);
                if (canPlace) {
                    dragSrc = { card: card, src: src, idx: idx, rowIdx: rowIdx };
                    handleDrop('foundation', fi, 0);
                    return;
                }
            }
        });

        // Кастомное визуальное перетаскивание
        cardEl.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.stopPropagation();

            let moved = false;
            const startX = e.clientX, startY = e.clientY;
            const rect = cardEl.getBoundingClientRect();
            const offsetX = startX - rect.left, offsetY = startY - rect.top;
            let ghost: HTMLElement | null = null;

            // Снятие document-слушателей и «призрака»; вызывается на mouseup
            // и при закрытии окна (фикс аудита — утечка слушателей mid-drag).
            function cleanupDrag(): void {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (ghost) { ghost.remove(); ghost = null; }
                dragCleanups.delete(cleanupDrag);
            }

            function onMove(ev: MouseEvent): void {
                const dx = ev.clientX - startX, dy = ev.clientY - startY;
                if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
                if (!moved) {
                    moved = true;
                    ghost = document.createElement('div');
                    ghost.style.cssText = 'position:fixed; pointer-events:none; z-index:10000; width:68px;';

                    if (src === 'waste') {
                        ghost.appendChild(makeCard(card, true));
                        cardEl.style.opacity = '0.3'; // Затемняем оригинал
                    } else if (src === 'tableau' && rowIdx !== undefined) {
                        const cardsToDrag = tableau[idx].slice(rowIdx);
                        cardsToDrag.forEach((dragCard, i) => {
                            const dragEl = makeCard(dragCard, true);
                            dragEl.style.position = 'relative';
                            dragEl.style.marginTop = i === 0 ? '0' : '-80px'; // Сохраняем отступы стопки
                            dragEl.style.zIndex = String(i + 1);
                            ghost!.appendChild(dragEl);
                        });
                        // Затемняем все перетаскиваемые карты в колонке
                        let curr: Element | null = cardEl;
                        while (curr) {
                            (curr as HTMLElement).style.opacity = '0.3';
                            curr = curr.nextElementSibling;
                        }
                    }
                    document.body.appendChild(ghost);
                }
                if (ghost) {
                    ghost.style.left = (ev.clientX - offsetX) + 'px';
                    ghost.style.top = (ev.clientY - offsetY) + 'px';
                }
            }

            function onUp(ev: MouseEvent): void {
                cleanupDrag();
                if (!moved) return;

                const target = document.elementFromPoint(ev.clientX, ev.clientY);
                const dropTarget = target ? (target.closest('.sol-foundation') || target.closest('.sol-col')) as HTMLElement | null : null;

                dragSrc = { card: card, src: src, idx: idx, rowIdx: rowIdx };

                let success = false;
                if (dropTarget) {
                    if (dropTarget.classList.contains('sol-foundation')) {
                        success = handleDrop('foundation', parseInt(dropTarget.dataset.fi || '0', 10), 0);
                    } else if (dropTarget.classList.contains('sol-col')) {
                        success = handleDrop('tableau', parseInt(dropTarget.dataset.ci || '0', 10), 0);
                    }
                }
                // Если не получилось сбросить в правильное место, перезапускаем рендер,
                // чтобы вернуть прозрачность (opacity) к норме
                if (!success) render();
            }

            dragCleanups.add(cleanupDrag);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function handleDrop(dest: 'foundation' | 'tableau', destIdx: number, _destRow: number): boolean {
        if (!dragSrc) return false;
        const { card, src, idx, rowIdx } = dragSrc;
        dragSrc = null;

        if (dest === 'foundation') {
            const f = foundations[destIdx];
            const topCard = f.length ? f[f.length - 1] : null;
            const canPlace = (!topCard && card.v === 'A') ||
                (topCard !== null && topCard.s === card.s && valIdx(card.v) === valIdx(topCard.v) + 1);
            if (!canPlace) return false;
            // В дом можно класть только по одной карте
            if (src === 'waste') { waste.pop(); f.push(card); score += 10; }
            else if (src === 'tableau' && rowIdx !== undefined) {
                if (rowIdx !== tableau[idx].length - 1) return false;
                tableau[idx].pop();
                f.push(card);
                score += 10;
                if (tableau[idx].length && !tableau[idx][tableau[idx].length - 1].face) { tableau[idx][tableau[idx].length - 1].face = true; score += 5; }
            }
            solFoundMoves++;
        } else if (dest === 'tableau') {
            const col = tableau[destIdx];
            const topCard = col.length ? col[col.length - 1] : null;
            const canPlace = (!topCard && card.v === 'K') ||
                (topCard !== null && topCard.face && isRed(topCard.s) !== isRed(card.s) && valIdx(topCard.v) === valIdx(card.v) + 1);
            if (!canPlace) return false;
            if (src === 'waste') { waste.pop(); col.push(card); score += 5; }
            else if (src === 'tableau' && rowIdx !== undefined) {
                // Переносим карту и все открытые карты под ней
                const movingCards = tableau[idx].slice(rowIdx);
                tableau[idx] = tableau[idx].slice(0, rowIdx);
                movingCards.forEach(mc => { col.push(mc); });
                score += 3;
                if (tableau[idx].length && !tableau[idx][tableau[idx].length - 1].face) { tableau[idx][tableau[idx].length - 1].face = true; score += 5; }
            }
        }
        // E7: первый ход в Косынке
        if (solFirstMove) {
            solFirstMove = false;
            emit('clippy-react', { category: 'react_sol_firstmove', anim: 'talk', duration: 5000, delay: 300 });
        }
        // E8: возможный пат — 10+ ходов без хода в дом
        solMoveCount++;
        if ((solMoveCount - solFoundMoves) > 10) {
            solMoveCount = 0;
            emit('clippy-react', { category: 'react_sol_stuck', anim: 'think', duration: 5000, delay: 300 });
        }
        render();
        return true;
    }

    const newBtn = document.getElementById('sol-new');
    if (newBtn) newBtn.addEventListener('click', startGame);
    startGame();
}

export function initSolitaire(): void {
    registerAction('app:solitaire', openSolitaire);
}
