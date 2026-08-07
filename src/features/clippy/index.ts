// Помощник «Скрепка» (Clippy): SVG-персонаж в углу, пузырь с фразами,
// анимации, реакции на события приложения.
// Порт script.js:6276-6286 (состояние), 7946-8371 (логика) и разрозненных вызовов clippySay.
// В ребилде вместо глобальных вызовов — подписки на event-bus (core/events).

import './clippy.css';
import { CLIPPY_MSGS } from './phrases';
import type { ClippyAnim, ClippyMsg } from './phrases';
import { getBool, getStrOrNull, setItem, setJSON, removeItem, safeParse } from '../../core/store';
import { on } from '../../core/events';
import { registerAction, runAction, ACTION } from '../../core/actions';
import { rafThrottle } from '../../core/debounce';
import { links, trashedLinks } from '../../core/state';
import { wmWindows } from '../../wm/windowManager';
import { showContextMenu } from '../contextmenu';
import { closeStartMenu } from '../startmenu';

// Ключи хранилища (контракт паритета с оригиналом; в core/keys.ts их нет — локальные для фичи)
const KEY_CLIPPY_ENABLED = 'edge_clippy_enabled';
const KEY_CLIPPY_POS = 'edge_clippy_pos';
const KEY_CLIPPY_LAST_VISIT = 'edge_clippy_last_visit';
const KEY_DDRIVE_SEEN = 'edge_ddrive_seen';

// ==================== СОСТОЯНИЕ (порт script.js:6277-6285) ====================

let clippyEnabled = false; // выставляется в initClippy() из хранилища
let idleTimer: number | undefined;
let blinkTimer: number | undefined;
let lookTimer: number | undefined;
let animTimer: number | undefined;
let talkInterval: number | undefined;
let sleepTimer: number | undefined;
let curAnim: ClippyAnim = 'idle';
let prevLinksLen = 0;  // длина links на прошлый links-changed (реакция на создание ярлыка)
let prevTrashLen = 0;  // длина корзины на прошлый trash-changed (удаление/опустошение)

// ФИКС АУДИТА: rect обёртки кэшируется, а не считается на каждый mousemove.
// Инвалидируется при перетаскивании, смене позиции и ресайзе окна.
let pupilRect: DOMRect | null = null;

function clippyInvalidatePupilRect(): void {
    pupilRect = null;
}

// ==================== ДЕЙСТВИЯ ИЗ ФРАЗ (замена window[a.fn] из оригинала) ====================

function clippyShowHelp(): void {
    clippySay({
        text: 'Я Скрепка! Открываю приложения, даю советы по играм и напоминаю о полезных функциях. Попробуйте!',
        anim: 'wave',
        actions: [{ label: 'Сапёр', fn: 'clippyOpenMinesweeper' }, { label: 'Блокнот', fn: 'clippyOpenNotepad' }]
    });
}

/** Реестр обработчиков кнопок пузыря (fn из phrases.ts). */
const CLIPPY_ACTION_FNS: Record<string, () => void> = {
    clippyShowHelp: clippyShowHelp,
    clippyOpenMinesweeper: () => { closeStartMenu(); runAction('app:minesweeper'); },
    clippyOpenMyComputer: () => { closeStartMenu(); runAction(ACTION.openMyComputer); },
    clippyOpenCalculator: () => { closeStartMenu(); runAction('app:calculator'); },
    clippyOpenNotepad: () => { closeStartMenu(); runAction('app:notepad'); },
    clippyOpenSolitaire: () => { closeStartMenu(); runAction('app:solitaire'); },
    clippyOpenPaint: () => { closeStartMenu(); runAction('app:paint'); },
    clippyOpenHearts: () => { closeStartMenu(); runAction('app:hearts'); },
};

// ==================== ИНИЦИАЛИЗАЦИЯ DOM ====================

function clippyInit(): void {
    if (!clippyEnabled) return;
    if (document.getElementById('clippy-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'clippy-wrap';
    wrap.innerHTML = [
        '<div id="clippy-bubble" class="hidden">',
        '  <button id="clippy-bubble-close" title="Закрыть">&#x2715;</button>',
        '  <div id="clippy-bubble-text"></div>',
        '  <div id="clippy-bubble-actions"></div>',
        '</div>',
        '<svg id="clippy-svg" viewBox="0 0 300 400" width="90" height="120"',
        '     xmlns="http://www.w3.org/2000/svg" class="clippy-anim-idle">',
        '  <defs>',
        '    <linearGradient id="clippy-metal" x1="0%" y1="0%" x2="100%" y2="100%">',
        '      <stop offset="0%" stop-color="#f0f0f0" />',
        '      <stop offset="50%" stop-color="#a0a0a0" />',
        '      <stop offset="100%" stop-color="#505050" />',
        '    </linearGradient>',
        '    <linearGradient id="clippy-feather" x1="0%" y1="0%" x2="100%" y2="0%">',
        '      <stop offset="0%" stop-color="#e0e0e0" />',
        '      <stop offset="100%" stop-color="#909090" />',
        '    </linearGradient>',
        '  </defs>',
        '  <g id="clippy-legs">',
        '    <path d="M 115 300 Q 110 330 100 350" stroke="url(#clippy-metal)" stroke-width="8" fill="none" stroke-linecap="round"/>',
        '    <ellipse cx="95" cy="350" rx="14" ry="7" fill="url(#clippy-metal)"/>',
        '    <path d="M 155 300 Q 165 330 170 350" stroke="url(#clippy-metal)" stroke-width="8" fill="none" stroke-linecap="round"/>',
        '    <ellipse cx="175" cy="350" rx="14" ry="7" fill="url(#clippy-metal)"/>',
        '  </g>',
        '  <g id="clippy-body">',
        '    <path d="M 150 130 L 150 230 A 15 15 0 0 1 120 230 L 120 100 A 30 30 0 0 1 180 100 L 180 260 A 45 45 0 0 1 90 260 L 90 140" stroke="rgba(0,0,0,0.15)" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(5, 5)"/>',
        '    <path d="M 150 130 L 150 230 A 15 15 0 0 1 120 230 L 120 100 A 30 30 0 0 1 180 100 L 180 260 A 45 45 0 0 1 90 260 L 90 140" stroke="url(#clippy-metal)" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        '    <path d="M 150 130 L 150 230 A 15 15 0 0 1 120 230 L 120 100 A 30 30 0 0 1 180 100 L 180 260 A 45 45 0 0 1 90 260 L 90 140" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" transform="translate(-3, -3)"/>',
        '  </g>',
        '  <path id="clippy-arm-r" d="M 180 200 Q 220 210 210 240 Q 200 230 180 240" stroke="url(#clippy-metal)" stroke-width="8" fill="none" stroke-linecap="round"/>',
        '  <g id="clippy-arm-l" style="transform-origin: 90px 200px;">',
        '    <path d="M 90 200 Q 50 220 40 170" stroke="url(#clippy-metal)" stroke-width="8" fill="none" stroke-linecap="round"/>',
        '    <path d="M 40 170 C 10 130 10 70 30 50 C 50 80 55 130 40 170 Z" fill="url(#clippy-feather)" stroke="#555" stroke-width="2"/>',
        '    <path d="M 30 50 Q 40 110 40 170" stroke="#555" stroke-width="2" fill="none"/>',
        '  </g>',
        '  <g id="clippy-face">',
        '    <g id="clippy-eye-l" style="transform-origin: 115px 115px;">',
        '      <circle cx="115" cy="115" r="16" fill="#fff" stroke="#333" stroke-width="2"/>',
        '      <circle id="clippy-pupil-l" cx="115" cy="115" r="7" fill="#111"/>',
        '      <circle cx="117" cy="112" r="2.5" fill="#fff"/>',
        '    </g>',
        '    <g id="clippy-eye-r" style="transform-origin: 160px 115px;">',
        '      <circle cx="160" cy="115" r="16" fill="#fff" stroke="#333" stroke-width="2"/>',
        '      <circle id="clippy-pupil-r" cx="160" cy="115" r="7" fill="#111"/>',
        '      <circle cx="162" cy="112" r="2.5" fill="#fff"/>',
        '    </g>',
        '    <path id="clippy-brow-l" d="M 100 95 Q 115 85 130 95" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/>',
        '    <path id="clippy-brow-r" d="M 145 95 Q 160 85 175 95" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/>',
        '    <g id="clippy-mouth-wrapper">',
        '      <path id="clippy-mouth" d="M 125 150 Q 137 165 150 150 Z" fill="#7a2a2a" stroke="#333" stroke-width="2"/>',
        '      <path id="clippy-tongue" d="M 130 155 Q 137 160 145 155 Z" fill="#ff7777"/>',
        '    </g>',
        '  </g>',
        '</svg>'
    ].join('\n');
    document.body.appendChild(wrap);
    clippyInitDrag(wrap);
    clippyRestorePos(wrap);
    const closeBtn = document.getElementById('clippy-bubble-close');
    if (closeBtn) closeBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation(); clippyDismiss();
    });
    clippyStartBlink();
    clippyStartLookAround();

    // C5: Ховер-поглаживание
    let hoverTimer: number | undefined;
    wrap.addEventListener('mouseenter', () => {
        hoverTimer = window.setTimeout(() => {
            const bub = document.getElementById('clippy-bubble');
            if (bub && bub.classList.contains('hidden')) {
                clippySetAnim('wave');
                clippyMouthExpr('smile');
                setTimeout(() => { clippyMouthExpr('neutral'); }, 1500);
            }
        }, 2000);
    });
    wrap.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); });

    // C7: Двойной клик — случайный совет
    wrap.addEventListener('dblclick', (e: MouseEvent) => {
        if ((e.target as Element).closest('#clippy-bubble')) return;
        e.preventDefault();
        clippySay(CLIPPY_MSGS.tip_general, 'think', 7000);
    });

    // D2+D3: Приветствие с учётом времени суток и возврата после >24ч
    const lastVisit = parseInt(getStrOrNull(KEY_CLIPPY_LAST_VISIT) || '0', 10);
    const nowTs = Date.now();
    const isReturn = (nowTs - lastVisit) > 24 * 60 * 60 * 1000 && lastVisit > 0;
    setItem(KEY_CLIPPY_LAST_VISIT, String(nowTs));
    setTimeout(() => {
        if (isReturn) {
            clippySay(CLIPPY_MSGS.react_return, 'wave');
        } else {
            const h = new Date().getHours();
            const msgs = h >= 0 && h < 5 ? CLIPPY_MSGS.react_night
                       : h < 12          ? CLIPPY_MSGS.greet_morning
                       : h < 18          ? CLIPPY_MSGS.greet
                       :                   CLIPPY_MSGS.greet_evening;
            const greetAnim: ClippyAnim = (h >= 0 && h < 5) ? 'think' : 'wave';
            clippySay(msgs, greetAnim);
        }
    }, 2000);

    // C3: Запуск таймера сна
    clippyStartSleepTimer();
    clippyScheduleIdle();
}

/** Полный снос Скрепки: все таймеры + DOM (оригинал: script.js:4264-4267 и 8300-8303). */
function clippyDestroy(): void {
    clearTimeout(idleTimer); idleTimer = undefined;
    clearTimeout(blinkTimer); blinkTimer = undefined;
    clearTimeout(lookTimer); lookTimer = undefined;
    clearTimeout(animTimer); animTimer = undefined;
    clearTimeout(sleepTimer); sleepTimer = undefined;
    if (talkInterval !== undefined) { clearInterval(talkInterval); talkInterval = undefined; }
    const wrap = document.getElementById('clippy-wrap');
    if (wrap) wrap.remove();
}

/** Включить/выключить Скрепку (порт чекбокса настроек script.js:4259-4268). */
function setClippyEnabled(enabled: boolean): void {
    clippyEnabled = enabled;
    setItem(KEY_CLIPPY_ENABLED, enabled ? 'true' : 'false');
    const existWrap = document.getElementById('clippy-wrap');
    if (enabled && !existWrap) { clippyInit(); }
    else if (!enabled && existWrap) { clippyDestroy(); }
}

// ==================== РЕЧЬ / ПУЗЫРЬ ====================

export function clippySay(msgOrArray: ClippyMsg[] | ClippyMsg, anim?: ClippyAnim, duration?: number): void {
    if (!clippyEnabled) return;
    const bubble = document.getElementById('clippy-bubble');
    if (!bubble) return;
    duration = duration || 7000;
    let msg: ClippyMsg = Array.isArray(msgOrArray)
        ? msgOrArray[Math.floor(Math.random() * msgOrArray.length)]
        : msgOrArray;
    if (typeof msg === 'string') msg = { text: msg };
    const useAnim = msg.anim || anim || 'talk';
    clippySetAnim(useAnim);
    clippyMouthExpr('talk');
    if (talkInterval !== undefined) clearInterval(talkInterval);
    let talkPhase = true;
    talkInterval = window.setInterval(() => {
        talkPhase = !talkPhase;
        clippyMouthExpr(talkPhase ? 'talk' : 'neutral');
    }, 320);
    if (sleepTimer !== undefined) { clearTimeout(sleepTimer); sleepTimer = undefined; }
    const textEl = document.getElementById('clippy-bubble-text');
    const actEl = document.getElementById('clippy-bubble-actions');
    if (!textEl || !actEl) return;
    textEl.textContent = msg.text;
    actEl.innerHTML = '';
    (msg.actions || []).forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'clippy-action-btn';
        btn.textContent = a.label;
        btn.addEventListener('click', () => {
            clippyDismiss();
            const fn = CLIPPY_ACTION_FNS[a.fn];
            if (fn) fn();
        });
        actEl.appendChild(btn);
    });
    bubble.classList.remove('hidden');
    // Не давать пузырю уходить за левый/правый край экрана
    bubble.style.left = '';
    const wrapEl = document.getElementById('clippy-wrap');
    if (!wrapEl) return;
    const wrapRect = wrapEl.getBoundingClientRect();
    const defaultLeft = -130;
    const clampedLeft = Math.max(5 - wrapRect.left, defaultLeft);
    const clampedRight = window.innerWidth - 230 - wrapRect.left;
    bubble.style.left = Math.min(clampedLeft > defaultLeft ? clampedLeft : defaultLeft, clampedRight > 0 ? clampedRight : defaultLeft) + 'px';
    clearTimeout(animTimer);
    animTimer = window.setTimeout(clippyDismiss, duration);
}

export function clippyDismiss(): void {
    if (talkInterval !== undefined) { clearInterval(talkInterval); talkInterval = undefined; }
    const bubble = document.getElementById('clippy-bubble');
    if (bubble) bubble.classList.add('hidden');
    clippySetAnim('idle');
    clippyMouthExpr('neutral');
    clippyScheduleIdle();
}

function clippySetAnim(state: ClippyAnim): void {
    const svg = document.getElementById('clippy-svg');
    if (!svg) return;
    Array.from(svg.classList).forEach(cls => {
        if (/^clippy-anim-/.test(cls)) svg.classList.remove(cls);
    });
    curAnim = state;
    svg.classList.add('clippy-anim-' + state);
    if (state !== 'idle') {
        clearTimeout(animTimer);
        animTimer = window.setTimeout(() => {
            if (curAnim === state) clippySetAnim('idle');
        }, 3000);
    }
}

type MouthExpr = 'neutral' | 'talk' | 'smile' | 'sad';

function clippyMouthExpr(type: MouthExpr): void {
    const m = document.getElementById('clippy-mouth');
    const t = document.getElementById('clippy-tongue');
    if (!m) return;

    const paths: Record<MouthExpr, string> = {
        neutral: 'M 125 150 Q 137 155 150 150 Z',
        talk:    'M 125 150 Q 137 165 150 150 Z',
        smile:   'M 122 148 Q 137 170 153 148 Z',
        sad:     'M 125 155 Q 137 145 150 155 Z',
    };

    if (paths[type]) m.setAttribute('d', paths[type]);
    if (t) t.style.display = (type === 'neutral' || type === 'sad') ? 'none' : 'block';
}

// ==================== ТАЙМЕРЫ ЖИЗНИ (моргание, осматривание, idle, сон) ====================

function clippyStartBlink(): void {
    function doBlink(): void {
        const svg = document.getElementById('clippy-svg');
        if (!svg) return;
        svg.classList.add('clippy-blinking');
        setTimeout(() => { if (svg) svg.classList.remove('clippy-blinking'); }, 200);
        blinkTimer = window.setTimeout(doBlink, 2500 + Math.random() * 3000);
    }
    blinkTimer = window.setTimeout(doBlink, 3000);
}

function clippyStartLookAround(): void {
    const dirs = ['clippy-look-left', 'clippy-look-right', 'clippy-look-up', ''];
    function doLook(): void {
        const svg = document.getElementById('clippy-svg');
        if (!svg) return;
        svg.classList.remove('clippy-look-left', 'clippy-look-right', 'clippy-look-up');
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        if (d) svg.classList.add(d);
        lookTimer = window.setTimeout(() => {
            if (svg) svg.classList.remove('clippy-look-left', 'clippy-look-right', 'clippy-look-up');
            lookTimer = window.setTimeout(doLook, 4000 + Math.random() * 5000);
        }, 1200);
    }
    lookTimer = window.setTimeout(doLook, 5000);
}

function clippyScheduleIdle(): void {
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
        const bubble = document.getElementById('clippy-bubble');
        if (!bubble || !bubble.classList.contains('hidden')) return;
        // C8: с шансом 20% — анимация выглядывания вместо сообщения
        if (Math.random() < 0.2) {
            clippyDoPeek();
        } else {
            clippySay(CLIPPY_MSGS.idle_random, 'think');
        }
        clippyStartSleepTimer();
    }, 4 * 60 * 1000 + Math.random() * 2 * 60 * 1000);
}

// C8: Выглядывание из-за правого края
function clippyDoPeek(): void {
    const wrap = document.getElementById('clippy-wrap');
    if (!wrap) return;
    wrap.classList.add('clippy-peeking');
    setTimeout(() => { wrap.classList.remove('clippy-peeking'); clippyScheduleIdle(); }, 3100);
}

// C3: Таймер сна (15 минут бездействия)
function clippyStartSleepTimer(): void {
    if (sleepTimer !== undefined) clearTimeout(sleepTimer);
    sleepTimer = window.setTimeout(() => {
        const wrap = document.getElementById('clippy-wrap');
        const bub = document.getElementById('clippy-bubble');
        if (!wrap || !bub || !bub.classList.contains('hidden')) return;
        clippySetAnim('yawn');
        clippyMouthExpr('smile');
        setTimeout(() => {
            clippyMouthExpr('neutral');
            clippySetAnim('sleep');
            if (talkInterval !== undefined) { clearInterval(talkInterval); talkInterval = undefined; }
            bub.classList.remove('hidden');
            const textEl = document.getElementById('clippy-bubble-text');
            const actEl = document.getElementById('clippy-bubble-actions');
            if (textEl) textEl.textContent = 'Zzz...';
            if (actEl) actEl.innerHTML = '';
        }, 2200);
    }, 15 * 60 * 1000);
}

// ==================== ПОЗИЦИЯ / DRAG ====================

let clippyDesiredPos: { x: number; y: number } | null = null;

function clippyApplyPos(wrap: HTMLElement | null): void {
    if (!wrap) return;
    if (clippyDesiredPos === null) {
        wrap.style.left = ''; wrap.style.top = '';
        wrap.style.right = ''; wrap.style.bottom = '';
        clippyInvalidatePupilRect();
        return;
    }
    const x = Math.max(0, Math.min(clippyDesiredPos.x, window.innerWidth - 90));
    const y = Math.max(0, Math.min(clippyDesiredPos.y, window.innerHeight - 120));
    wrap.style.right = ''; wrap.style.bottom = '';
    wrap.style.left = x + 'px'; wrap.style.top = y + 'px';
    clippyInvalidatePupilRect();
}

function clippyInitDrag(wrap: HTMLElement): void {
    const svg = wrap.querySelector<HTMLElement>('#clippy-svg');
    if (!svg) return;
    svg.addEventListener('contextmenu', (e: MouseEvent) => {
        if ((e.target as Element).closest('#clippy-bubble')) return;
        e.preventDefault(); e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
            { label: 'Что ты умеешь?', icon: '❓', action: () => { clippyShowHelp(); } },
            { label: 'Случайный совет', icon: '💡', action: () => { clippySay(CLIPPY_MSGS.tip_general, 'think'); } },
            { separator: true },
            { label: 'Сапёр',       icon: '💣', action: () => { runAction('app:minesweeper'); } },
            { label: 'Калькулятор', icon: '🔢', action: () => { runAction('app:calculator'); } },
            { label: 'Блокнот',     icon: '📝', action: () => { runAction('app:notepad'); } },
            { label: 'Написать заметку', icon: '✏️', action: () => {
                runAction('app:notepad');
                setTimeout(() => {
                    const ta = document.querySelector<HTMLTextAreaElement>('.notepad-textarea');
                    if (ta && !ta.value) ta.value = new Date().toLocaleDateString('ru') + '\n\n';
                }, 300);
            } },
            { separator: true },
            { label: 'Вернуть в угол', icon: '📌', action: () => {
                clippyDesiredPos = null;
                removeItem(KEY_CLIPPY_POS);
                clippyApplyPos(wrap);
            } },
            { label: 'Скрыть Скрепку', icon: '🚫', danger: true, action: () => {
                setClippyEnabled(false);
            } }
        ]);
    });
    svg.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as Element).closest('#clippy-bubble')) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        const rect = svg.getBoundingClientRect();
        const ox = rect.left, oy = rect.top;
        wrap.style.right = ''; wrap.style.bottom = '';
        wrap.style.left = ox + 'px'; wrap.style.top = oy + 'px';
        wrap.classList.add('clippy-dragging');
        // C4: Испуг при начале перетаскивания
        clippySetAnim('alert');
        clippyMouthExpr('talk');
        // C6: Переменные для определения тряски
        let shakeLastX = ox, shakeLastY = oy, shakePts = 0;
        let shakeTimer: number | undefined;
        function onM(ev: MouseEvent): void {
            const nx = Math.max(0, Math.min(window.innerWidth - 80, ox + ev.clientX - sx));
            const ny = Math.max(0, Math.min(window.innerHeight - 120, oy + ev.clientY - sy));
            const speed = Math.sqrt(Math.pow(nx - shakeLastX, 2) + Math.pow(ny - shakeLastY, 2));
            shakeLastX = nx; shakeLastY = ny;
            if (speed > 15) { shakePts++; } else { shakePts = Math.max(0, shakePts - 1); }
            if (shakePts > 8 && shakeTimer === undefined) {
                shakePts = 0;
                clippySetAnim('alert');
                clippyMouthExpr('sad');
                shakeTimer = window.setTimeout(() => {
                    shakeTimer = undefined;
                    clippySay(['Ой-ой-ой! Осторожнее!'], 'alert', 3000);
                }, 300);
            }
            wrap.style.left = nx + 'px';
            wrap.style.top = ny + 'px';
        }
        function onU(): void {
            document.removeEventListener('mousemove', onM);
            document.removeEventListener('mouseup', onU);
            wrap.classList.remove('clippy-dragging');
            clippyDesiredPos = { x: wrap.offsetLeft, y: wrap.offsetTop };
            setJSON(KEY_CLIPPY_POS, clippyDesiredPos);
            clippyInvalidatePupilRect();
            // C4: Успокоение + фраза после перетаскивания
            clippySetAnim('idle');
            clippyMouthExpr('neutral');
            const bub = document.getElementById('clippy-bubble');
            if (bub && bub.classList.contains('hidden')) {
                setTimeout(() => {
                    clippySay(CLIPPY_MSGS.react_dragged, 'wave', 4000);
                }, 500);
            }
        }
        document.addEventListener('mousemove', onM);
        document.addEventListener('mouseup', onU);
    });
}

function clippyRestorePos(wrap: HTMLElement): void {
    const pos = safeParse<{ x: number; y: number } | null>(getStrOrNull(KEY_CLIPPY_POS), null);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        clippyDesiredPos = { x: pos.x, y: pos.y };
    } else {
        clippyDesiredPos = null;
    }
    clippyApplyPos(wrap);
}

// ==================== ЗРАЧКИ СЛЕДЯТ ЗА КУРСОРОМ (C2) ====================
// ФИКС АУДИТА: обработчик через rafThrottle (максимум раз за кадр),
// getBoundingClientRect — из кэша pupilRect (инвалидируется при сдвиге/ресайзе).

const onPupilMouseMove = rafThrottle((e: MouseEvent) => {
    const wrapEl = document.getElementById('clippy-wrap');
    if (!wrapEl) return;
    if (!pupilRect) pupilRect = wrapEl.getBoundingClientRect();
    const faceCX = pupilRect.left + pupilRect.width * 0.5;
    const faceCY = pupilRect.top + pupilRect.height * 0.3;
    const dx = e.clientX - faceCX;
    const dy = e.clientY - faceCY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const t = Math.min(dist, 200) / 200;
    const ox = (dx / dist) * t * 4;
    const oy = (dy / dist) * t * 4;
    const pl = document.getElementById('clippy-pupil-l');
    const pr = document.getElementById('clippy-pupil-r');
    if (pl) { pl.setAttribute('cx', String(115 + ox)); pl.setAttribute('cy', String(115 + oy)); }
    if (pr) { pr.setAttribute('cx', String(160 + ox)); pr.setAttribute('cy', String(115 + oy)); }
});

// ==================== РЕАКЦИИ НА СОБЫТИЯ ПРИЛОЖЕНИЯ ====================
// В оригинале — размазанные вызовы clippySay; здесь — подписки на event-bus.
// Вероятности Math.random() и setTimeout-задержки — как в оригинале.

function clippySubscribeEvents(): void {
    // saveAndRender (script.js:124-133): реакция на создание ярлыка
    on('links-changed', () => {
        if (links.length > prevLinksLen) {
            if (links.length === 1) setTimeout(() => { clippySay(CLIPPY_MSGS.react_created, 'wave'); }, 500);
            else if (links.length > 5) setTimeout(() => { clippySay(CLIPPY_MSGS.tip_general, 'think'); }, 600);
        }
        prevLinksLen = links.length;
    });

    // trashLink (script.js:2208) + опустошение корзины (script.js:2166-2168)
    on('trash-changed', () => {
        const len = trashedLinks.length;
        if (len > prevTrashLen) {
            if (Math.random() < 0.4) {
                setTimeout(() => { clippySay(CLIPPY_MSGS.react_delete_shortcut, 'wave', 3000); }, 200);
            }
        } else if (len === 0 && prevTrashLen > 0) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_bin_empty, 'sad', 5000); }, 300);
        }
        prevTrashLen = len;
    });

    // wmCreate (script.js:2498-2504): совет по приложению / много окон
    on('wm-opened', ({ id }) => {
        const appMsgs = CLIPPY_MSGS['app_' + id];
        if (appMsgs) {
            setTimeout(() => { clippySay(appMsgs, 'talk'); }, 800);
        } else if (Object.keys(wmWindows).length >= 5) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_many_windows, 'think'); }, 800);
        }
        // F6: первое открытие диска D: (script.js:3911-3914)
        if (id === 'bkmarks' && getStrOrNull(KEY_DDRIVE_SEEN) === null) {
            setItem(KEY_DDRIVE_SEEN, '1');
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_drive_d, 'excited', 6000); }, 1000);
        }
    });

    // wmClose (script.js:2596-2598): закрыто последнее окно
    on('wm-closed', () => {
        if (Object.keys(wmWindows).length === 0) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_win_closed, 'wave', 4000); }, 400);
        }
    });

    // Повторное открытие того же приложения (script.js:2450-2452)
    on('wm-dup-open', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_dup_app, 'think', 4000); }, 300);
    });

    // Смена темы/режима вида (script.js:4164-4166, 4216-4218)
    on('settings-changed', ({ key }) => {
        if (key === 'theme' || key === 'viewMode') {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_settings_change, 'wave', 4000); }, 500);
        }
    });

    // Открытие календаря (script.js:3451-3453)
    on('calendar-opened', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_calendar, 'talk', 4000); }, 300);
    });

    // Изменение громкости (script.js:3533-3535)
    on('volume-changed', () => {
        if (Math.random() < 0.4) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_volume_change, 'wave', 3000); }, 200);
        }
    });

    // Экспорт данных (script.js:6033-6035)
    on('data-exported', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_export_data, 'wave', 4000); }, 300);
    });

    // Смена обоев (script.js:6044)
    on('wallpaper-changed', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_wallpaper_change, 'wave', 4000); }, 300);
    });

    // Открытие меню Пуск (script.js:3205)
    on('startmenu-opened', () => {
        if (Math.random() < 0.15) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_start_menu_open, 'wave', 3000); }, 300);
        }
    });

    // Скриншот ярлыка (script.js:3054-3056)
    on('screenshot-taken', () => {
        if (Math.random() < 0.25) {
            setTimeout(() => { clippySay(CLIPPY_MSGS.react_screenshot_taken, 'wave', 3500); }, 500);
        }
    });

    // Первый запуск (script.js:8823-8825)
    on('first-run-completed', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_first_run, 'wave', 5000); }, 1500);
    });

    // BSOD закрыт (script.js:483)
    on('bsod-ended', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_bsod, 'alert'); }, 3000);
    });

    // Найдено обновление (script.js:6075)
    on('update-available', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.react_update, 'excited'); }, 1000);
    });

    // Переполнение localStorage — реакция добавлена в ребилде (в оригинале события не было):
    // совет из общей базы (там есть фразы про экспорт данных) с тревожной анимацией.
    on('storage-quota', () => {
        setTimeout(() => { clippySay(CLIPPY_MSGS.tip_general, 'alert', 5000); }, 300);
    });
}

// ==================== ТОЧКА ВХОДА ====================

export function initClippy(): void {
    clippyEnabled = getBool(KEY_CLIPPY_ENABLED, true);
    prevLinksLen = links.length;
    prevTrashLen = trashedLinks.length;

    // Зрачки следят за курсором (один глобальный слушатель; живёт всегда,
    // внутри — guard по наличию #clippy-wrap, как в оригинале)
    document.addEventListener('mousemove', onPupilMouseMove);
    window.addEventListener('resize', clippyInvalidatePupilRect);

    // Действие для настроек: чекбокс «Скрепка» (порт script.js:4259-4268)
    registerAction<{ enabled: boolean }>('toggle-clippy', payload => {
        if (payload) setClippyEnabled(payload.enabled);
    });

    clippySubscribeEvents();

    if (clippyEnabled) clippyInit();
}
