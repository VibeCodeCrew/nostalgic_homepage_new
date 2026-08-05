// CMD.EXE — эмуляция командной строки Windows XP.
// Порт CMD.EXE (script.js:5945-6028). Клик-реакции Clippy не портируются.
// Фиксы аудита: история команд ограничена 50 записями (в оригинале росла
// бесконечно); все setTimeout-цепочки (ping, format, crash) отменяются
// при закрытии окна через onClose.

import './cmd.css';
import { el } from '../../../core/dom';
import { registerAction, runAction, ACTION } from '../../../core/actions';
import { wmCreate, wmGet, wmRestore, wmFocus, wmClose, wmWindows } from '../../../wm/windowManager';

/** Максимум записей в истории команд (фикс аудита). */
const HISTORY_LIMIT = 50;

export function openCmd(): void {
    if (wmWindows['cmd']) { wmRestore('cmd'); wmFocus('cmd'); return; }
    const c = el('div', { className: 'cmd-window' });
    c.innerHTML = '<div id="cmd-output" class="cmd-output"></div><div class="cmd-input-row"><span class="cmd-prompt">C:\\></span><input id="cmd-input" class="cmd-input" type="text" autocomplete="off" spellcheck="false"></div>';
    wmCreate('cmd', 'Командная строка', c, 560, 380, '⬛');
    setTimeout(() => {
        const out = document.getElementById('cmd-output');
        const inp = document.getElementById('cmd-input') as HTMLInputElement | null;
        if (!out || !inp) return;
        let cwd = 'C:\\Users\\User';
        const env: Record<string, string> = { PATH: 'C:\\Windows\\System32', WINDIR: 'C:\\Windows', USERNAME: 'User', OS: 'Windows_NT' };
        const history: string[] = [];
        let histIdx = -1;
        // Все отложенные выводы (ping/format/crash) — отменяются при закрытии окна
        const timers: Array<ReturnType<typeof setTimeout>> = [];
        function later(fn: () => void, ms: number): void {
            timers.push(setTimeout(fn, ms));
        }

        function print(text: string, cls?: string): void {
            const l = el('div', { text: text });
            if (cls) l.className = cls;
            out!.appendChild(l);
            out!.scrollTop = out!.scrollHeight;
        }

        print('Microsoft Windows XP [Версия 5.1.2600]', 'cmd-header');
        print('(C) Корпорация Майкрософт, 1985-2001.', 'cmd-header');
        print('');

        const COMMANDS: Record<string, (args: string) => void> = {
            help: () => {
                ['cls - очистить экран', 'dir - список файлов', 'echo [текст] - вывести текст', 'cd [путь] - сменить каталог', 'set - переменные среды', 'ver - версия Windows', 'color - цвет текста', 'time - текущее время', 'date - текущая дата', 'title [заголовок] - заголовок окна', 'ping [хост] - пинг', 'ipconfig - сетевые настройки', 'tasklist - список задач', 'taskkill - завершить задачу', 'chkdsk - проверка диска', 'format - форматировать диск', 'shutdown - завершение работы', 'exit - закрыть окно'].forEach(l => { print(l); });
            },
            ver: () => { print('Microsoft Windows XP [Версия 5.1.2600]'); },
            cls: () => { out!.innerHTML = ''; },
            dir: () => { ['  Volume in drive C is SYSTEM', '  Volume Serial Number is DEAD-BEEF', '', 'Directory of ' + cwd, '', '[.]   [..]   Program Files   Windows   Users', '', '               5 File(s)    0 bytes', '               2 Dir(s)  80,523,321,344 bytes free'].forEach(l => { print(l); }); },
            cd: args => {
                if (!args || args === '..') { cwd = cwd.split('\\').slice(0, -1).join('\\') || 'C:\\'; return; }
                cwd = cwd + '\\' + args;
            },
            echo: args => { print(args || ''); },
            time: () => { print('Текущее время: ' + new Date().toLocaleTimeString('ru-RU')); },
            date: () => { print('Текущая дата: ' + new Date().toLocaleDateString('ru-RU')); },
            set: args => {
                if (!args) { Object.keys(env).forEach(k => { print(k + '=' + env[k]); }); }
                else {
                    const parts = args.split('=');
                    const k = parts[0];
                    const v = parts.slice(1).join('=');
                    if (v.length) env[k] = v;
                    else print(env[k] || args + ' не является внутренней или внешней');
                }
            },
            color: () => { print('Цвет изменён (это просто эмуляция).'); },
            title: args => {
                const w = wmWindows['cmd'];
                if (w) {
                    const t = w.el.querySelector('.xp-titlebar-title');
                    if (t) t.textContent = args || 'Командная строка';
                }
            },
            ping: args => {
                const h = args || 'ya.ru';
                print('Обмен пакетами с ' + h + ' [77.88.55.66]:');
                [1, 2, 3, 4].forEach(i => {
                    later(() => { print('Ответ от 77.88.55.66: число байт=32 время=' + (20 + Math.round(Math.random() * 30)) + 'мс TTL=55'); }, i * 400);
                });
            },
            ipconfig: () => { ['Windows IP Configuration', '', 'Ethernet adapter Local Area Connection:', '   Connection-specific DNS Suffix: local', '   IP Address. . . . . . . . . : 192.168.1.' + Math.floor(Math.random() * 200 + 2), '   Subnet Mask . . . . . . . . : 255.255.255.0', '   Default Gateway . . . . . . : 192.168.1.1'].forEach(l => { print(l); }); },
            tasklist: () => { ['Image Name      PID Session Name  Mem Usage', '============  ===== ============ ==========', 'System Idle P.    0 Console       28 K', 'System            4 Console      216 K', 'explorer.exe    888 Console   18,452 K', 'iexplore.exe   1024 Console   32,768 K', 'notepad.exe    1337 Console    4,096 K'].forEach(l => { print(l); }); },
            taskkill: () => {
                print('УСПЕХ: процесс завершён.');
            },
            chkdsk: () => { ['Тип файловой системы: NTFS', 'Серийный номер тома: 3A2F-87D1', 'CHKDSK проверяет файлы (этап 1 из 3)...', '  100 percent of file verification complete.', 'CHKDSK проверяет индексы (этап 2 из 3)...', '  100 percent completed.', 'CHKDSK проверяет дескрипторы безопасности (этап 3 из 3)...', 'Windows проверила файловую систему и не обнаружила проблем.', '  20,971,520 КБ всего места на диске.', '  11,534,336 КБ занято.', '   9,437,184 КБ свободно.'].forEach(l => { print(l); }); },
            format: () => {
                print('Предупреждение: все данные будут потеряны!');
                print('Нажмите Y для продолжения или N для отмены...');
                later(() => { print('Форматирование... Ладно, пожалею ваши данные. :)'); }, 1000);
            },
            shutdown: () => { runAction(ACTION.shutdown); },
            exit: () => { wmClose('cmd'); },
            tree: () => { ['C:\\', '├── Windows', '│   ├── System32', '│   └── SysWOW64', '├── Program Files', '│   ├── Internet Explorer', '│   └── Windows Media Player', '└── Users', '    └── User', '        ├── Desktop', '        ├── Documents', '        └── Downloads'].forEach(l => { print(l); }); },
            systeminfo: () => { ['Имя узла:   USER-PC', 'ОС:         Microsoft Windows XP Professional', 'Версия ОС:  5.1.2600 Service Pack 3 Build 2600', 'ОС (доп.):  Standalone Workstation', 'ОЗУ:        1024 МБ', 'Пр. память: ' + Math.floor(Math.random() * 400 + 200) + ' МБ'].forEach(l => { print(l); }); },
            crash: () => {
                print('Инициирован критический сбой системы...');
                // BSOD-экран — зона другой фичи; вызываем через командный реестр (действие 'bsod')
                later(() => { runAction('bsod'); }, 800);
            },
        };

        function prompt2(): string { return cwd + '>'; }

        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const line = inp!.value;
                print(prompt2() + line);
                if (line.trim()) {
                    history.unshift(line);
                    if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT; // фикс аудита
                    histIdx = -1;
                }
                inp!.value = '';
                const parts = line.trim().toLowerCase().split(' ');
                const cmd = parts[0];
                const arg = parts.slice(1).join(' ');
                if (cmd === '') { return; }
                if (COMMANDS[cmd]) { COMMANDS[cmd](arg); }
                else if (cmd) {
                    print("'" + cmd + "' не является внутренней или внешней командой", 'cmd-error');
                    print('исполняемой программой или пакетным файлом.', 'cmd-error');
                }
            } else if (e.key === 'ArrowUp') {
                histIdx = Math.min(histIdx + 1, history.length - 1);
                inp!.value = history[histIdx] || '';
            } else if (e.key === 'ArrowDown') {
                histIdx = Math.max(histIdx - 1, -1);
                inp!.value = history[histIdx] || '';
            }
        });
        setTimeout(() => { inp!.focus(); }, 100);
        // Фикс утечки: отменяем все отложенные выводы при закрытии окна
        const w = wmGet('cmd');
        if (w) {
            w.onClose = () => { timers.forEach(clearTimeout); };
        }
    }, 0);
}

export function initCmd(): void {
    registerAction('app:cmd', openCmd);
}
