// Всплывающий календарь по клику на часы трея (и на часы меню-бара macos) —
// порт CALENDAR (script.js:3446-3504). Реакции Клиппи не портируются (не наша зона).

import { emit } from '../../core/events';

export function toggleCalendar(): void {
    const existing = document.getElementById('xp-calendar');
    if (existing) { existing.remove(); return; }
    emit('calendar-opened');
    const now = new Date();
    let calYear = now.getFullYear();
    let calMonth = now.getMonth();
    const root = document.createElement('div');
    root.id = 'xp-calendar';
    root.className = 'xp-calendar';
    document.body.appendChild(root);

    function renderCal(): void {
        const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const today = new Date();
        const td = today.getDate(), tm = today.getMonth(), ty = today.getFullYear();
        const first = new Date(calYear, calMonth, 1);
        let startDow = first.getDay();
        if (startDow === 0) startDow = 7; // Mon=1
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const daysInPrev = new Date(calYear, calMonth, 0).getDate();
        // Разметка статична (числа/месяцы — не пользовательские строки), innerHTML безопасен
        let html = '<div class="xp-cal-header">' +
            '<span class="xp-cal-nav" id="xp-cal-prev">&#9664;</span>' +
            '<span>' + MONTHS[calMonth] + ' ' + calYear + '</span>' +
            '<span class="xp-cal-nav" id="xp-cal-next">&#9654;</span>' +
            '</div><div class="xp-cal-grid">';
        DAYS.forEach((d) => { html += '<div class="xp-cal-dow">' + d + '</div>'; });
        for (let i = 1; i < startDow; i++) {
            html += '<div class="xp-cal-day other-month">' + (daysInPrev - startDow + 1 + i) + '</div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = d === td && calMonth === tm && calYear === ty;
            html += '<div class="xp-cal-day' + (isToday ? ' today' : '') + '">' + d + '</div>';
        }
        const total = startDow - 1 + daysInMonth;
        const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
        for (let i = 1; i <= remainder; i++) html += '<div class="xp-cal-day other-month">' + i + '</div>';
        html += '</div>';
        root.innerHTML = html;
        document.getElementById('xp-cal-prev')!.addEventListener('click', (e) => {
            e.stopPropagation();
            calMonth--;
            if (calMonth < 0) { calMonth = 11; calYear--; }
            renderCal();
        });
        document.getElementById('xp-cal-next')!.addEventListener('click', (e) => {
            e.stopPropagation();
            calMonth++;
            if (calMonth > 11) { calMonth = 0; calYear++; }
            renderCal();
        });
    }
    renderCal();
    const anchor = document.getElementById('tray-clock');
    if (anchor) {
        const r = anchor.getBoundingClientRect();
        root.style.bottom = (window.innerHeight - r.top + 2) + 'px';
        root.style.right = (window.innerWidth - r.right) + 'px';
    }
    setTimeout(() => {
        document.addEventListener('click', function dismiss(ev) {
            if (!root.contains(ev.target as Node) && ev.target !== document.getElementById('tray-clock')) {
                root.remove();
                document.removeEventListener('click', dismiss);
            }
        });
    }, 10);
}
