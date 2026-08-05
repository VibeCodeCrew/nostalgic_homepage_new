// MS Paint — canvas-рисовалка: карандаш, заливка, ластик, фигуры, текст.
// Порт MS PAINT (script.js:5799-5912). Клик-реакции Clippy не портируются.

import './paint.css';
import { el, xpIconHtml } from '../../../core/dom';
import { registerAction } from '../../../core/actions';
import { wmCreate, wmRestore, wmFocus, wmResizeToContent, wmWindows } from '../../../wm/windowManager';

export function openPaint(): void {
    if (wmWindows['paint']) { wmRestore('paint'); wmFocus('paint'); return; }
    const c = el('div', { className: 'paint-window' });
    c.innerHTML = '<div class="paint-toolbar"><div class="paint-tools"><button class="paint-tool active" data-tool="pencil" title="Карандаш">✏️</button><button class="paint-tool" data-tool="fill" title="Заливка">🪣</button><button class="paint-tool" data-tool="eraser" title="Ластик">🧹</button><button class="paint-tool" data-tool="rect" title="Прямоугольник">▭</button><button class="paint-tool" data-tool="circle" title="Эллипс">⬭</button><button class="paint-tool" data-tool="line" title="Линия">/</button><button class="paint-tool" data-tool="text" title="Текст">A</button></div><div class="paint-colors" id="paint-colors"></div><div class="paint-size-wrap"><label style="font-size:10px">Размер: <input type="range" id="paint-size" min="1" max="30" value="3"></label></div><button class="xp-dialog-btn" id="paint-clear" style="font-size:10px">Очистить</button><button class="xp-dialog-btn" id="paint-save" style="font-size:10px">Сохранить PNG</button></div><div class="paint-canvas-wrap"><canvas id="paint-canvas" width="680" height="420"></canvas></div>';
    wmCreate('paint', 'Paint', c, 720, 540, xpIconHtml('paint', 16));
    setTimeout(() => {
        const canvas = document.getElementById('paint-canvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let tool = 'pencil', color = '#000000', size = 3, drawing = false, startX = 0, startY = 0;
        let snapshot: ImageData | null = null;

        const COLORS = ['#000000', '#7f7f7f', '#880000', '#ff0000', '#ff7f00', '#ffff00', '#00a500', '#00ff00', '#003080', '#0000ff', '#4b0082', '#8f00ff', '#ff69b4', '#ffffff', '#c0c0c0', '#d2691e'];
        const colorWrap = document.getElementById('paint-colors');
        if (!colorWrap) return;
        COLORS.forEach(col => {
            const sw = el('div', { className: 'paint-swatch' + (col === color ? ' active' : '') });
            sw.style.background = col;
            sw.addEventListener('click', () => {
                color = col;
                c.querySelectorAll('.paint-swatch').forEach(s => { s.classList.remove('active'); });
                sw.classList.add('active');
            });
            colorWrap.appendChild(sw);
        });
        // Произвольный цвет
        const cp = el('input', { type: 'color', value: color, style: 'width:22px;height:22px;padding:0;border:1px solid #999;cursor:pointer;' });
        cp.addEventListener('input', () => { color = cp.value; });
        colorWrap.appendChild(cp);

        c.querySelectorAll('.paint-tool').forEach(btn => {
            btn.addEventListener('click', () => {
                c.querySelectorAll('.paint-tool').forEach(b => { b.classList.remove('active'); });
                btn.classList.add('active');
                tool = (btn as HTMLElement).dataset.tool || 'pencil';
            });
        });

        const sizeInp = document.getElementById('paint-size') as HTMLInputElement | null;
        if (sizeInp) sizeInp.addEventListener('input', () => { size = parseInt(sizeInp.value, 10); });

        const clearBtn = document.getElementById('paint-clear');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
        const saveBtn = document.getElementById('paint-save');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = canvas.toDataURL();
            a.download = 'paint.png';
            a.click();
        });

        function getPos(e: MouseEvent): { x: number; y: number } {
            const r = canvas!.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }

        function floodFill(x: number, y: number, fillColor: string): void {
            const idata = ctx!.getImageData(0, 0, canvas!.width, canvas!.height);
            const data = idata.data;
            const w = canvas!.width, h = canvas!.height;
            const px = (Math.round(y) * w + Math.round(x)) * 4;
            const or = data[px], og = data[px + 1], ob = data[px + 2], oa = data[px + 3];
            const fr = parseInt(fillColor.slice(1, 3), 16), fg = parseInt(fillColor.slice(3, 5), 16), fb = parseInt(fillColor.slice(5, 7), 16);
            if (or === fr && og === fg && ob === fb) return;
            const stack: Array<[number, number]> = [[Math.round(x), Math.round(y)]];
            function set(sx: number, sy: number): void { const i = (sy * w + sx) * 4; data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255; }
            function match(sx: number, sy: number): boolean { const i = (sy * w + sx) * 4; return data[i] === or && data[i + 1] === og && data[i + 2] === ob && data[i + 3] === oa; }
            while (stack.length) {
                const p = stack.pop()!;
                const cx = p[0], cy = p[1];
                if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
                if (!match(cx, cy)) continue;
                set(cx, cy);
                stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
            }
            ctx!.putImageData(idata, 0, 0);
        }

        canvas.addEventListener('mousedown', e => {
            const p = getPos(e);
            drawing = true;
            startX = p.x;
            startY = p.y;
            if (tool === 'fill') { floodFill(p.x, p.y, color); return; }
            if (tool === 'text') {
                const t = prompt('Текст:');
                if (t) { ctx.font = (size * 5) + 'px Arial'; ctx.fillStyle = color; ctx.fillText(t, p.x, p.y); }
                return;
            }
            snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (tool === 'pencil' || tool === 'eraser') { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        });
        canvas.addEventListener('mousemove', e => {
            if (!drawing) return;
            const p = getPos(e);
            if (tool === 'pencil') {
                ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
                ctx.lineTo(p.x, p.y); ctx.stroke();
            } else if (tool === 'eraser') {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = size * 3; ctx.lineCap = 'round';
                ctx.lineTo(p.x, p.y); ctx.stroke();
            } else if (tool === 'rect' || tool === 'circle' || tool === 'line') {
                if (snapshot) ctx.putImageData(snapshot, 0, 0);
                ctx.strokeStyle = color; ctx.lineWidth = size;
                if (tool === 'rect') { ctx.strokeRect(startX, startY, p.x - startX, p.y - startY); }
                else if (tool === 'circle') {
                    ctx.beginPath();
                    ctx.ellipse(startX + (p.x - startX) / 2, startY + (p.y - startY) / 2, Math.abs(p.x - startX) / 2, Math.abs(p.y - startY) / 2, 0, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (tool === 'line') {
                    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(p.x, p.y); ctx.stroke();
                }
            }
        });
        canvas.addEventListener('mouseup', () => { drawing = false; snapshot = null; });
        canvas.addEventListener('mouseleave', () => { drawing = false; });

        // Подгонка окна под фиксированный холст + тулбар без скроллбаров
        setTimeout(() => {
            const toolbar = document.querySelector('#win-paint .paint-toolbar') as HTMLElement | null;
            if (canvas && toolbar) {
                const pad = 8;
                const desiredW = canvas.width + pad * 2;
                const desiredH = toolbar.offsetHeight + canvas.height + pad * 2;
                wmResizeToContent('paint', desiredW, desiredH, 400, 300, 900, 700);
            }
        }, 0);
    }, 0);
}

export function initPaint(): void {
    registerAction('app:paint', openPaint);
}
