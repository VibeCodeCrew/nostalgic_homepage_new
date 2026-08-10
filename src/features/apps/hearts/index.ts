// Червы (Hearts): 4 игрока, три бота с простым ИИ. Порт HEARTS (script.js:5568-5798).
// Клик-реакции Clippy из оригинала не портируются (по ТЗ).

import './hearts.css';
import { registerAction } from '../../../core/actions';
import { emit } from '../../../core/events';
import { xpIconHtml } from '../../../core/dom';
import { wmCreate, wmGet, wmRestore, wmFocus, wmResizeToContent } from '../../../wm/windowManager';

interface Card { s: string; v: string }
interface TrickCard { player: number; card: Card }

// Отложенный вызов с регистрацией таймера (для очистки при закрытии окна)
type LaterFn = (fn: () => void, ms: number) => void;

export function openHearts(): void {
    if (wmGet('hearts')) { wmRestore('hearts'); wmFocus('hearts'); return; }
    const c = document.createElement('div');
    c.className = 'hearts-window';
    c.innerHTML = '<div id="hearts-status" style="padding:6px 10px;font-size:11px;background:#c0d8c0;border-bottom:1px solid #8a8">Ваш ход. Разыграйте карту.</div><div id="hearts-table" class="hearts-table"></div><div id="hearts-hand" class="hearts-hand"></div><div style="padding:4px 8px;background:#e8f0e8;border-top:1px solid #cdc;display:flex;gap:16px" id="hearts-scores"></div>';
    wmCreate('hearts', 'Червы', c, 800, 480, xpIconHtml('hearts', 16));
    // ФИКС АУДИТА: все таймеры игры собираются в массив и снимаются в onClose —
    // в оригинале «висячие» setTimeout могли сработать после уничтожения DOM окна.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later: LaterFn = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const w = wmGet('hearts');
    if (w) w.onClose = () => { timers.forEach(t => clearTimeout(t)); timers.length = 0; };
    later(() => startHearts(later), 0);
}

function startHearts(later: LaterFn): void {
    const SUITS = ['♠', '♥', '♦', '♣'], VALS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    function vi(v: string): number { return VALS.indexOf(v); }
    function isHeart(c: Card): boolean { return c.s === '♥'; }
    function isQS(c: Card): boolean { return c.s === '♠' && c.v === 'Q'; }
    function points(c: Card): number { return isHeart(c) ? 1 : isQS(c) ? 13 : 0; }

    let hands: Card[][], trick: number, trickLead: number, trickSuit: string | null,
        scores: number[], heartsBroken: boolean, trickCards: TrickCard[] | null, status: string;
    const names = ['Вы', 'Бот 1', 'Бот 2', 'Бот 3'];

    function newGame(): void {
        const deck: Card[] = [];
        SUITS.forEach(s => { VALS.forEach(v => { deck.push({ s: s, v: v }); }); });
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        hands = [deck.slice(0, 13), deck.slice(13, 26), deck.slice(26, 39), deck.slice(39, 52)];
        scores = [0, 0, 0, 0]; trick = 0; heartsBroken = false; trickCards = null;
        // Find who has 2♣
        trickLead = hands.findIndex(h => h.some(c => c.s === '♣' && c.v === '2'));
        trickSuit = null; status = '';
        renderHearts();
        later(continueHearts, 300);
    }

    function continueHearts(): void {
        if (!wmGet('hearts')) return;
        // Bots play first if not player's turn
        while (trickLead !== 0 && trickCards && trickCards.length < 4) {
            botPlay(trickLead);
        }
        renderHearts();
        if (trickCards && trickCards.length === 4) {
            later(resolveTrick, 800);
        }
    }

    function botPlay(p: number): void {
        if (!trickCards) trickCards = [];
        const hand = hands[p];
        let card: Card;
        if (trickCards.length === 0) {
            // Lead: play lowest non-heart if possible
            const safe = hand.filter(c => !isHeart(c) && !isQS(c));
            card = safe.length ? safe.reduce((a, b) => vi(a.v) < vi(b.v) ? a : b) : hand[0];
            trickSuit = card.s;
        } else {
            const follow = hand.filter(c => c.s === trickSuit);
            if (follow.length) {
                card = follow.reduce((a, b) => vi(a.v) < vi(b.v) ? a : b);
            } else {
                // Dump points if possible
                const pts = hand.filter(c => points(c) > 0);
                card = pts.length ? pts[0] : hand[0];
            }
        }
        hands[p] = hand.filter(c => c !== card);
        trickCards.push({ player: p, card: card });
        if (isHeart(card) || isQS(card)) heartsBroken = true;
        // Next player
        trickLead = (trickLead + 1) % 4;
    }

    function playerPlay(card: Card): void {
        if (!trickCards) trickCards = [];
        const hand = hands[0];
        // Validate: must follow suit
        if (trickCards.length > 0) {
            const hasSuit = hand.some(c => c.s === trickSuit);
            if (hasSuit && card.s !== trickSuit) { setStatus('Нужно ходить в масть ' + trickSuit + '!'); return; }
        } else {
            trickSuit = card.s;
            // Can't lead hearts unless broken
            if (isHeart(card) && !heartsBroken) {
                const hasNonHeart = hand.some(c => !isHeart(c));
                if (hasNonHeart) { setStatus('Червы ещё не разбиты!'); return; }
            }
        }
        if (isHeart(card) || isQS(card)) heartsBroken = true;
        hands[0] = hand.filter(c => c !== card);
        trickCards.push({ player: 0, card: card });
        // E?: реакция на первый ход игрока в Червах
        if (trick === 0 && trickCards.length === 1) {
            emit('clippy-react', { category: 'react_hearts_first_move', anim: 'wave', duration: 4000, delay: 400 });
        }
        trickLead = (trickLead + 1) % 4;
        renderHearts();
        later(() => {
            if (!wmGet('hearts')) return;
            while (trickCards!.length < 4) { botPlay(trickLead); }
            renderHearts();
            later(resolveTrick, 700);
        }, 200);
    }

    function resolveTrick(): void {
        if (!trickCards || !wmGet('hearts')) return;
        // Find winner: highest card of lead suit
        let winner = trickCards[0];
        trickCards.forEach(tc => {
            if (tc.card.s === trickCards![0].card.s && vi(tc.card.v) > vi(winner.card.v)) winner = tc;
        });
        // Award points
        trickCards.forEach(tc => { scores[winner.player] += points(tc.card); });
        trick++;
        trickCards = null;
        trickLead = winner.player;
        trickSuit = null;
        setStatus(names[winner.player] + ' берёт взятку.');

        // Check end of round
        if (hands[0].length === 0) {
            // Check shoot the moon
            const shootIdx = scores.findIndex(s => s === 26);
            if (shootIdx >= 0) {
                scores = scores.map((s, i) => i === shootIdx ? 0 : s + 26);
                setStatus(names[shootIdx] + ' взял все штрафы! +26 всем остальным.');
                // E9: shooting the moon — радость, если игрок; уважение, если бот
                emit('clippy-react', { category: 'react_hearts_moon', anim: shootIdx === 0 ? 'excited' : 'wave', delay: 600 });
            }
            renderHearts();
            later(() => {
                const msg = names.map((n, i) => n + ': ' + scores[i]).join('\n');
                // E9: победа/поражение в Червах
                const playerScore = scores[0];
                const maxScore = Math.max.apply(null, scores);
                const minScore = Math.min.apply(null, scores);
                if (playerScore === minScore) {
                    emit('clippy-react', { category: 'react_hearts_win', anim: 'excited', delay: 100 });
                } else if (playerScore === maxScore) {
                    emit('clippy-react', { category: 'react_hearts_loss', anim: 'sad', delay: 100 });
                }
                if (confirm('Раунд окончен!\n' + msg + '\nСыграть ещё?')) newGame();
            }, 500);
            return;
        }
        renderHearts();
        if (trickLead !== 0) later(() => {
            if (!wmGet('hearts')) return;
            botPlay(trickLead); trickLead = (trickLead + 1) % 4;
            if (trickCards!.length < 4) { /* player's turn */ } else { later(resolveTrick, 700); }
            renderHearts();
        }, 600);
    }

    function setStatus(msg: string): void {
        status = msg;
        const statusEl = document.getElementById('hearts-status');
        if (statusEl) statusEl.textContent = msg;
    }

    function renderHearts(): void {
        if (!wmGet('hearts')) return;
        const table = document.getElementById('hearts-table');
        const handEl = document.getElementById('hearts-hand');
        const scEl = document.getElementById('hearts-scores');
        if (!table || !handEl || !scEl) return;

        // Table: show trick cards
        table.innerHTML = '';
        if (trickCards && trickCards.length) {
            trickCards.forEach(tc => {
                const pos = ['bottom', 'left', 'top', 'right'][tc.player];
                const cd = document.createElement('div');
                cd.className = 'hearts-trick-card hearts-card ' + (tc.card.s === '♥' || tc.card.s === '♦' ? 'hearts-red' : 'hearts-black');
                cd.style.gridArea = pos;
                cd.textContent = tc.card.v + tc.card.s;
                table.appendChild(cd);
            });
        }
        // Bot hand sizes
        [1, 2, 3].forEach(p => {
            const pc = document.createElement('div');
            pc.className = 'hearts-bot-count';
            pc.style.gridArea = ['left', 'top', 'right'][p - 1];
            pc.textContent = names[p] + ': ' + hands[p].length + ' карт';
            table.appendChild(pc);
        });

        // Player hand
        handEl.innerHTML = '';
        const myHand = hands[0];
        myHand.sort((a, b) => { if (a.s !== b.s) return SUITS.indexOf(a.s) - SUITS.indexOf(b.s); return vi(a.v) - vi(b.v); });
        myHand.forEach(card => {
            const cd = document.createElement('div');
            cd.className = 'hearts-card ' + (isHeart(card) || card.s === '♦' ? 'hearts-red' : 'hearts-black');
            cd.textContent = card.v + card.s;
            cd.style.cursor = (trickLead === 0 || trickCards === null) ? 'pointer' : 'default';
            if (trickLead === 0 || trickCards === null) {
                cd.addEventListener('click', () => { playerPlay(card); });
            }
            handEl.appendChild(cd);
        });

        // Scores
        scEl.innerHTML = names.map((n, i) => '<span>' + n + ': <b>' + scores[i] + '</b></span>').join('');
    }

    function resizeHeartsWindow(): void {
        if (!wmGet('hearts')) return;
        const statusEl = document.getElementById('hearts-status');
        const table = document.getElementById('hearts-table');
        const hand = document.getElementById('hearts-hand');
        const scoresEl = document.getElementById('hearts-scores');
        if (!table || !hand) return;
        // Measure natural hand width: 13 cards * ~56px + gaps
        const cardW = 56, gap = 4;
        const handNaturalW = 13 * cardW + 12 * gap + 16; // + padding
        const desiredW = Math.max(620, handNaturalW, table.scrollWidth + 16);
        const desiredH = (statusEl ? statusEl.offsetHeight : 30) + table.scrollHeight + hand.scrollHeight + (scoresEl ? scoresEl.offsetHeight : 30) + 24;
        wmResizeToContent('hearts', desiredW, desiredH, 620, 360, 900, 700);
    }

    newGame();
    later(resizeHeartsWindow, 0);
}

export function initHearts(): void {
    registerAction('app:hearts', openHearts);
}
