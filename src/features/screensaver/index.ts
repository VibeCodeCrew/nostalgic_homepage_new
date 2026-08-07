// Заставка «Трубы» (3D pipes в стиле XP): запуск после бездействия,
// ручной предпросмотр из настроек («Просмотр»), выход по активности пользователя.
// Порт блока SCREENSAVER из оригинала (script.js:6170-6275), паритет 1:1.

import { getBool, getInt } from '../../core/store';
import { throttle } from '../../core/debounce';
import { registerAction, ACTION } from '../../core/actions';

// Ключи настроек — контракт оригинала (в keys.ts их нет, читаем напрямую через store).
const KEY_SS_ENABLED = 'edge_ss_enabled';
const KEY_SS_DELAY = 'edge_ss_delay';

// Троттлинг трекинга активности (фикс аудита): в оригинале каждый mousemove/keydown
// делал clearTimeout+setTimeout без throttle. Таймер заставки минутный,
// поэтому точности в 1 с более чем достаточно.
const ACTIVITY_THROTTLE_MS = 1000;

let ssTimer: ReturnType<typeof setTimeout> | null = null;
let ssActive = false;
let ssEl: HTMLElement | null = null;
let ssInterval: ReturnType<typeof setInterval> | null = null;

interface Pipe {
    x: number;
    y: number;
    dir: number;   // 0=вправо, 1=вниз, 2=влево, 3=вверх
    color: string;
    len: number;
}

/** Перезапуск таймера бездействия; вызывается троттлированно из обработчиков активности. */
export function resetScreensaver(): void {
    if (ssActive) stopScreensaver();
    if (ssTimer !== null) clearTimeout(ssTimer);
    if (!getBool(KEY_SS_ENABLED, true)) return;
    const delayMin = getInt(KEY_SS_DELAY, 5);
    ssTimer = setTimeout(() => startScreensaver(), delayMin * 60 * 1000);
}

/**
 * Запуск заставки. preview=true — ручной запуск из настроек («Просмотр»);
 * в оригинале startScreensaver() без параметров, поведение предпросмотра
 * и таймера идентично, флаг оставлен для явности точки входа.
 */
export function startScreensaver(preview = false): void {
    void preview;
    if (ssActive) return;
    ssActive = true;
    ssEl = document.createElement('div');
    ssEl.id = 'screensaver';
    ssEl.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;cursor:none;overflow:hidden;';

    // Анимированная заставка «трубы»
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;height:100%;';
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    ssEl.appendChild(cv);
    document.body.appendChild(ssEl);

    const ctx = cv.getContext('2d');
    if (!ctx) { stopScreensaver(); return; }
    const PIPE_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800'];
    const CELL = 20;
    const cols = Math.floor(cv.width / CELL);
    const rows = Math.floor(cv.height / CELL);

    const pipes: Pipe[] = [];
    function newPipe(): Pipe {
        return {
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows),
            dir: Math.floor(Math.random() * 4), // 0=right,1=down,2=left,3=up
            color: PIPE_COLORS[Math.floor(Math.random() * PIPE_COLORS.length)],
            len: 0,
        };
    }

    for (let i = 0; i < 6; i++) pipes.push(newPipe());

    function drawPipeSegment(p: Pipe, fromX: number, fromY: number): void {
        ctx!.strokeStyle = p.color;
        ctx!.lineWidth = CELL * 0.55;
        ctx!.lineCap = 'round';
        ctx!.lineJoin = 'round';
        ctx!.beginPath();
        ctx!.moveTo(fromX * CELL + CELL / 2, fromY * CELL + CELL / 2);
        ctx!.lineTo(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2);
        ctx!.stroke();
        // Шарнир-шарик
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(fromX * CELL + CELL / 2, fromY * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
        ctx!.fill();
    }

    let frame = 0;
    ssInterval = setInterval(() => {
        if (!ssActive) {
            if (ssInterval !== null) clearInterval(ssInterval);
            ssInterval = null;
            return;
        }
        frame++;
        if (frame % 2 !== 0) return; // замедление

        pipes.forEach(p => {
            const ox = p.x, oy = p.y;
            const DX = [1, 0, -1, 0][p.dir], DY = [0, 1, 0, -1][p.dir];
            const nx = p.x + DX, ny = p.y + DY;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || p.len > 60) {
                // Перезапуск трубы
                const np = newPipe(); p.x = np.x; p.y = np.y; p.dir = np.dir; p.color = np.color; p.len = 0; return;
            }
            // Случайный поворот
            if (Math.random() < 0.15) p.dir = (p.dir + [-1, 1][Math.floor(Math.random() * 2)] + 4) % 4;
            drawPipeSegment(p, ox, oy);
            p.x = p.x + DX; p.y = p.y + DY; p.len++;
        });

        // Надпись «Windows XP»
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Windows XP', cv.width / 2, cv.height / 2);
    }, 50);

    ssEl.addEventListener('mousemove', stopScreensaver);
    ssEl.addEventListener('keydown', stopScreensaver);
    ssEl.addEventListener('click', stopScreensaver);
}

export function stopScreensaver(): void {
    if (!ssActive) return;
    ssActive = false;
    if (ssInterval !== null) {
        clearInterval(ssInterval);
        ssInterval = null;
    }
    if (ssEl) {
        ssEl.remove();
        ssEl = null;
    }
    resetScreensaver();
    // TODO(coordinator): в оригинале здесь через 1 с срабатывал
    // clippySay(CLIPPY_MSGS.react_screensaver_off, 'wave') — подключить,
    // когда будет портирован clippy (события в EventMap для этого нет).
}

// Троттлированный трекинг активности (фикс аудита, см. ACTIVITY_THROTTLE_MS).
const onActivity = throttle(resetScreensaver, ACTIVITY_THROTTLE_MS);

export function initScreensaver(): void {
    registerAction('reset-screensaver', resetScreensaver);
    registerAction(ACTION.startScreensaver, () => startScreensaver(true /*preview*/));
    ['mousemove', 'mousedown', 'keydown', 'wheel'].forEach(ev => {
        document.addEventListener(ev, onActivity);
    });
    resetScreensaver();
}
