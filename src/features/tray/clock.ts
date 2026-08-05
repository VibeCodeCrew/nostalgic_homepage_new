// Часы трея и меню-бара macos — порт CLOCK (script.js:528-538).

export function updateClock(): void {
    const now = new Date();
    const te = document.getElementById('tray-time'), de = document.getElementById('tray-date');
    if (te) te.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (de) de.textContent = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    // Часы меню-бара (тема macos): «Пт 17:42»
    const mb = document.getElementById('mb-time');
    if (mb) mb.textContent = now.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '') + ' ' +
        now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Запустить секундный тик часов (tray-time/tray-date + #mb-time). */
export function startClock(): void {
    updateClock();
    setInterval(updateClock, 1000);
}
