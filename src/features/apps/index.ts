// Центральная инициализация встроенных приложений.
// Каждое приложение — независимый модуль, регистрирующий действие 'app:<id>'.

import { initNotepad } from './notepad';
import { initWordpad } from './wordpad';
import { initPaint } from './paint';
import { initCalculator } from './calculator';
import { initCmd } from './cmd';
import { initMinesweeper } from './minesweeper';
import { initSolitaire } from './solitaire';
import { initHearts } from './hearts';
import { initPinball } from './pinball';
import { initDoom } from './doom';

export function initApps(): void {
    initNotepad();
    initWordpad();
    initPaint();
    initCalculator();
    initCmd();
    initMinesweeper();
    initSolitaire();
    initHearts();
    initPinball();
    initDoom();
}
