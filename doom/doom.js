// ==================== DOOM — загрузчик doomgeneric (WASM) ====================
// Движок: doomgeneric.wasm (ozkl/doomgeneric, Emscripten-порт, GPL-2.0) —
// со звуковыми эффектами И музыкой (Timidity внутри wasm, патчи GUS
// в doomgeneric.data). Прежняя сборка cloudflare/doom-wasm (Chocolate Doom)
// заменена: её SDL_mixer-музыка зависала при инициализации.
// Игровые данные: shareware DOOM1.WAD (id Software) — внутри doomgeneric.data.
// Игра стартует автоматически: жест клика по ярлыку ещё жив
// (user activation), поэтому звук разблокирован сразу.

(function () {
    var canvas  = document.getElementById('canvas');
    var overlay = document.getElementById('doom-overlay');

    function showOverlay(text) { overlay.textContent = text; overlay.hidden = false; }
    function hideOverlay()     { overlay.hidden = true; }

    // Короткое информационное сообщение поверх кадра (само гаснет)
    var flashTimer = null;
    function flashOverlay(text, ms) {
        showOverlay(text);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(hideOverlay, ms || 1800);
    }

    // ---------------- Настройки звука (переключатели в полоске) ----------------
    // Движок читает sfx_volume/music_volume из default.cfg только при старте,
    // а снаружи (без пересборки wasm) до них не достучаться. Поэтому
    // переключатели хранятся в localStorage и применяются к конфигу
    // при каждом запуске игры; в работающей игре громкость меняется
    // родным меню DOOM (Esc → Options → Sound Volume).
    var AUDIO_KEY = 'doom_audio_v1';

    function loadAudio() {
        try {
            var a = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}') || {};
            return { sfx: a.sfx !== false, music: a.music !== false };
        } catch (e) { return { sfx: true, music: true }; }
    }

    function saveAudio(a) {
        try { localStorage.setItem(AUDIO_KEY, JSON.stringify(a)); } catch (e) {}
    }

    var audio = loadAudio();

    // Подменяем строки громкости в тексте конфига под переключатели
    function patchVolumes(cfg) {
        var sfx = audio.sfx ? 8 : 0, mus = audio.music ? 8 : 0;
        if (/^sfx_volume\s+\d+/m.test(cfg)) cfg = cfg.replace(/^sfx_volume\s+\d+/m, 'sfx_volume ' + sfx);
        else cfg += '\nsfx_volume ' + sfx;
        if (/^music_volume\s+\d+/m.test(cfg)) cfg = cfg.replace(/^music_volume\s+\d+/m, 'music_volume ' + mus);
        else cfg += '\nmusic_volume ' + mus;
        return cfg;
    }

    // Базовый конфиг для doomgeneric (формат m_config, Chocolate-совместимый).
    // Коды клавиш — doomkeys.h: порт доставляет Пробел как KEY_USE (0xa2=162),
    // поэтому key_fire=162 («Пробел — огонь»), key_use=102 ('f').
    // WASD + стрелки: key_up=119 ('w') и т.п.; мышь в порту не опрашивается.
    var CFG_TEMPLATE = [
        'show_messages 1',
        'key_right 174',
        'key_left 172',
        'key_up 119',
        'key_down 115',
        'key_strafeleft 97',
        'key_straferight 100',
        'key_fire 162',
        'key_use 102',
        'key_strafe 184',
        'key_speed 182',
        'screenblocks 10',
        'detaillevel 0',
        'snd_channels 8',
        'usegamma 1',
        ''
    ].join('\n');

    // ---------------- Сохранения ----------------
    // Движок пишет сейвы (*.dsg, подкаталог .savegame/) и default.cfg в MEMFS
    // (Emscripten), которая умирает вместе со страницей. Синхронизируем файлы
    // с localStorage — он общий с родительской страницей (один origin
    // chrome-extension://), синхронный и гарантированно доступен в iframe.
    // Перед main() восстанавливаем, дальше сливаем изменения каждые SYNC_MS
    // и при выгрузке окна.
    // ВАЖНО: формат сейвов doomgeneric несовместим с прежним движком
    // (Chocolate Doom, ключ doom_saves_v1) — старое хранилище удаляем.
    var SAVE_DIR  = '/.savegame';    // сюда doomgeneric кладёт doomsav*.dsg
    var CFG_PATH  = '/.default.cfg'; // configdir="." → M_StringJoin даёт ".default.cfg"
    var STORE_KEY = 'doom_saves_v2';
    var SYNC_MS   = 4000;

    function b64encode(u8) {
        var s = '';
        for (var i = 0; i < u8.length; i += 0x8000) {
            s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        }
        return btoa(s);
    }

    function b64decode(b64) {
        var s = atob(b64), u8 = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
        return u8;
    }

    function loadStoredSaves() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }

    function persistSaves(files) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(files)); }
        catch (e) { console.warn('[DOOM] Не удалось записать сейвы:', e); }
    }

    // Восстанавливаем файлы в MEMFS до старта main()
    // ВАЖНО: этот glue не экспортирует Module.FS — но это классическая
    // (не MODULARIZE) сборка Emscripten, поэтому FS доступен как window.FS.
    function restoreSaves(files) {
        var FS = window.FS;
        if (!FS) { console.warn('[DOOM] FS недоступен, сейвы не восстановлены'); return; }
        try {
            // Конфиг: сохранённый (с подменой громкостей) или шаблон
            var cfg = files['default.cfg'] ? new TextDecoder().decode(b64decode(files['default.cfg'])) : CFG_TEMPLATE;
            FS.writeFile(CFG_PATH, patchVolumes(cfg));
            // Сейвы
            try { FS.mkdir(SAVE_DIR); } catch (e) { /* уже есть */ }
            Object.keys(files).forEach(function (name) {
                if (name === 'default.cfg' || !/\.dsg$/i.test(name)) return;
                try { FS.writeFile(SAVE_DIR + '/' + name, b64decode(files[name])); } catch (e) {
                    console.warn('[DOOM] writeFile ' + name + ':', e && e.errno, e && e.stack);
                }
            });
        } catch (e) { console.warn('[DOOM] restoreSaves:', e && e.stack); }
    }

    var lastSyncHash = {};

    // Сливаем сейвы (*.dsg) и конфиг из MEMFS в хранилище, если изменились
    function syncSaves() {
        if (!started) return;
        var FS = window.FS;
        if (!FS) return;
        var files = {}, names = [];
        try { names = FS.readdir(SAVE_DIR); } catch (e) {}
        names.forEach(function (name) {
            if (!/\.dsg$/i.test(name)) return;
            try { files[name] = FS.readFile(SAVE_DIR + '/' + name); } catch (e) {}
        });
        // Страховка: вдруг порт пишет сейвы прямо в корень
        try {
            FS.readdir('/').forEach(function (name) {
                if (!/\.dsg$/i.test(name)) return;
                try { files[name] = FS.readFile('/' + name); } catch (e) {}
            });
        } catch (e) {}
        try { files['default.cfg'] = FS.readFile(CFG_PATH); } catch (e) {}
        var out = {}, changed = false;
        Object.keys(files).forEach(function (name) {
            var u8 = files[name];
            // Дешёвый хеш, чтобы не дёргать хранилище без изменений
            var h = u8.length + ':' + (u8[0] || 0) + ':' + (u8[u8.length >> 1] || 0) + ':' + (u8[u8.length - 1] || 0);
            if (lastSyncHash[name] !== h) { lastSyncHash[name] = h; changed = true; }
            out[name] = b64encode(u8);
        });
        if (changed) persistSaves(out);
    }

    setInterval(syncSaves, SYNC_MS);
    window.addEventListener('blur', syncSaves);
    window.addEventListener('pagehide', syncSaves);

    // ---------------- Синтетические клавиши (мышь-эмуляция) ----------------
    // Порт опрашивает только клавиатуру (SDL_KEYDOWN/KEYUP → очередь).
    // Мышь эмулируем синтетическими KeyboardEvent: SDL2-glue Emscripten
    // слушает document и переводит их в SDL-события по code/keyCode.
    function sendKey(type, key, code, keyCode) {
        var ev = new KeyboardEvent(type, {
            key: key, code: code, bubbles: true, cancelable: true
        });
        // Emscripten читает legacy-свойства — конструктор их не принимает
        try {
            Object.defineProperty(ev, 'keyCode', { value: keyCode });
            Object.defineProperty(ev, 'which',   { value: keyCode });
        } catch (e) { ev.keyCode = keyCode; ev.which = keyCode; }
        canvas.dispatchEvent(ev);
    }

    // ---------------- Управление мышью (pointer lock + эмуляция) ----------------
    // Порт мышь не опрашивает, поэтому поворот и кнопки эмулируем клавишами:
    // movementX → ←/→ (поворот), ЛКМ → Пробел (огонь), ПКМ → F (использовать).
    // «Мышь: вкл» — курсор захватывается (pointer lock) и скрывается;
    // «Мышь: выкл» — курсор отпускается, можно работать с рабочим столом.
    var mouseBtn = document.getElementById('mouse-toggle');
    var mouseOn = true;
    var started = false;

    var TURN_STEP_PX = 6;    // пикселей смещения на один «тап» стрелки
    var TURN_HOLD_MS = 50;   // длительность удержания стрелки на тап
    var turnAcc = 0, turnTimer = null, turnDir = null;

    function releaseTurn() {
        if (turnDir) {
            sendKey('keyup', turnDir === 1 ? 'ArrowRight' : 'ArrowLeft',
                    turnDir === 1 ? 'ArrowRight' : 'ArrowLeft', turnDir === 1 ? 39 : 37);
            turnDir = null;
        }
        turnTimer = null;
    }

    function pressTurn(dir) { // dir: 1 = вправо, -1 = влево
        var key = dir === 1 ? 'ArrowRight' : 'ArrowLeft';
        var code = dir === 1 ? 39 : 37;
        if (turnDir !== dir) { releaseTurn(); sendKey('keydown', key, key, code); turnDir = dir; }
        clearTimeout(turnTimer);
        turnTimer = setTimeout(releaseTurn, TURN_HOLD_MS);
    }

    document.addEventListener('mousemove', function (e) {
        if (!started || !mouseOn || document.pointerLockElement !== canvas) return;
        turnAcc += e.movementX || 0;
        while (turnAcc >= TURN_STEP_PX)  { turnAcc -= TURN_STEP_PX; pressTurn(1); }
        while (turnAcc <= -TURN_STEP_PX) { turnAcc += TURN_STEP_PX; pressTurn(-1); }
    }, true);

    // Кнопки мыши: ЛКМ — огонь (Пробел), ПКМ — использовать (F)
    var MOUSE_KEYS = { 0: [' ', 'Space', 32], 2: ['f', 'KeyF', 70] };
    canvas.addEventListener('mousedown', function (e) {
        if (!started || !mouseOn || document.pointerLockElement !== canvas) return;
        var k = MOUSE_KEYS[e.button];
        if (k) { e.preventDefault(); sendKey('keydown', k[0], k[1], k[2]); }
    });
    canvas.addEventListener('mouseup', function (e) {
        var k = MOUSE_KEYS[e.button];
        if (k) sendKey('keyup', k[0], k[1], k[2]);
    });

    function lockPointer() {
        if (!mouseOn || !started) return;
        if (!canvas.requestPointerLock) return;
        try {
            var p = canvas.requestPointerLock();
            if (p && p.catch) p.catch(function () {}); // нет жеста — захватим при следующем вводе
        } catch (e) {}
    }

    function setMouse(on) {
        mouseOn = on;
        canvas.style.pointerEvents = on ? '' : 'none';
        mouseBtn.textContent = on ? 'Мышь: вкл' : 'Мышь: выкл';
        mouseBtn.classList.toggle('off', !on);
        if (on) {
            canvas.focus();
            lockPointer();
        } else {
            releaseTurn();
            if (document.exitPointerLock) document.exitPointerLock();
        }
    }

    // Клик по кнопке не должен уходить в документ
    mouseBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    mouseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setMouse(!mouseOn);
    });

    // ---------------- Кнопки звука и музыки ----------------
    // Переключатели сохраняются сразу, в работающей игре применяются
    // при следующем запуске (движок читает громкости только на старте);
    // «на лету» громкость регулируется в меню DOOM.
    var sfxBtn   = document.getElementById('sfx-toggle');
    var musicBtn = document.getElementById('music-toggle');

    function renderAudioButtons() {
        sfxBtn.textContent   = audio.sfx ? 'Звук: вкл' : 'Звук: выкл';
        sfxBtn.classList.toggle('off', !audio.sfx);
        musicBtn.textContent = audio.music ? 'Музыка: вкл' : 'Музыка: выкл';
        musicBtn.classList.toggle('off', !audio.music);
    }

    function bindAudioButton(btn, prop, label) {
        btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            audio[prop] = !audio[prop];
            saveAudio(audio);
            renderAudioButtons();
            if (started) {
                flashOverlay(label + ': ' + (audio[prop] ? 'вкл' : 'выкл') +
                    ' — применится при следующем запуске (в игре: Esc → Options → Sound Volume)', 2600);
            }
        });
    }
    bindAudioButton(sfxBtn, 'sfx', 'Звук');
    bindAudioButton(musicBtn, 'music', 'Музыка');
    renderAudioButtons();

    // Клик по кадру повторно захватывает курсор: Esc в pointer lock
    // браузер отдаёт себе (снимает захват), а не игре.
    document.addEventListener('mousedown', function () { lockPointer(); });

    document.addEventListener('keydown', function (e) {
        // Игровые клавиши не должны делать браузерные действия
        // (скролл пробелом, отправка форм по Enter и т.п.)
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab' || e.key.indexOf('Arrow') === 0) {
            e.preventDefault();
        }
        // Горячая клавиша отпускания мыши: ` (тильда/Ё, по коду — раскладка не важна).
        // В Doom эта клавиша не занята (F-клавиши — под меню и сейвы).
        if (e.code === 'Backquote') {
            e.preventDefault();
            e.stopPropagation();
            if (started) setMouse(!mouseOn);
        }
    });

    // ---------------- Module / запуск движка ----------------
    // Module должен существовать до загрузки doomgeneric.js —
    // glue-код Emscripten читает его при инициализации.
    window.Module = {
        // Автостарт: жест клика по ярлыку DOOM ещё жив (user activation
        // распространяется на same-origin iframe) — звук разблокирован.
        canvas: canvas,
        arguments: [],

        // Конфиг и сейвы восстанавливаем в виртуальную ФС до старта main()
        // (localStorage синхронный). onRuntimeInitialized срабатывает после
        // инициализации FS и data-пакета (doom1.wad, timidity.cfg, патчи GUS),
        // но до callMain — движок ещё не прочитал default.cfg. Конфликтов
        // с data-пакетом нет: default.cfg и .savegame/ в нём отсутствуют.
        onRuntimeInitialized: function () {
            restoreSaves(loadStoredSaves());
        },

        // Рантайм поднялся, игра пошла: прячем оверлей, фокус и захват мыши
        postRun: [function () {
            started = true;
            hideOverlay();
            canvas.focus();
            lockPointer(); // мы в жесте пользователя — захватываем курсор
        }],

        print:    function (text) { console.log('[DOOM]', text); },
        printErr: function (text) { console.error('[DOOM]', text); },

        // Прогресс загрузки wasm/data на оверлей
        setStatus: function (text) {
            if (text) showOverlay('Загрузка DOOM…');
        },

        onAbort: function (what) {
            showOverlay('DOOM аварийно завершился :(');
            console.error('[DOOM] abort:', what);
        }
    };

    // Чистим следы прежних движков: снапшот jacobenget-порта в
    // chrome.storage.local и сейвы Chocolate Doom (несовместимый формат)
    try { chrome.storage.local.remove('doom_savestate'); } catch (e) {}
    try { localStorage.removeItem('doom_saves_v1'); } catch (e) {}

    canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        showOverlay('Потерян графический контекст — перезапустите окно');
    });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.onerror = function (msg, src, line, col) {
        console.error('[DOOM]', msg, src, line, col);
        // Фатально, только если рантайм не поднялся; на частичные ошибки
        // не пугаем пользователя — игра может работать дальше
        if (!started) showOverlay('Не удалось загрузить DOOM :(');
    };
})();
