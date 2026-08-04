// Звуки интерфейса — синтез через Web Audio API (файлов звуков в проекте нет, это нормально).

import { KEY_VOLUME } from './keys';
import { getFloat, setItem } from './store';

export type SoundType = 'open' | 'close' | 'minimize' | 'restore' | 'error' | 'notify' | 'startup';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

export function getVolume(): number {
    return getFloat(KEY_VOLUME, 0.7);
}

export function setVolume(v: number): void {
    setItem(KEY_VOLUME, String(v));
    if (masterGain) masterGain.gain.value = v;
}

function getAudio(): { ctx: AudioContext; gain: GainNode } | null {
    if (!audioCtx) {
        try {
            audioCtx = new AudioContext();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = getVolume();
            masterGain.connect(audioCtx.destination);
        } catch {
            return null;
        }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return { ctx: audioCtx, gain: masterGain! };
}

export function playSound(type: SoundType): void {
    const a = getAudio();
    if (!a) return;
    const ctx = a.ctx, master = a.gain;
    const t = ctx.currentTime;

    function tone(freq: number, startT: number, dur: number, wave?: OscillatorType, vol?: number): void {
        const og = ctx.createGain(); og.connect(master);
        const oo = ctx.createOscillator(); oo.connect(og);
        oo.type = wave || 'sine';
        oo.frequency.setValueAtTime(freq, t + startT);
        og.gain.setValueAtTime(vol || 0.18, t + startT);
        og.gain.exponentialRampToValueAtTime(0.0001, t + startT + dur);
        oo.start(t + startT); oo.stop(t + startT + dur + 0.02);
    }

    switch (type) {
        case 'open':     tone(523, 0, 0.07); tone(659, 0.06, 0.07); break;
        case 'close':    tone(659, 0, 0.07); tone(440, 0.06, 0.09); break;
        case 'minimize': tone(440, 0, 0.05); tone(330, 0.04, 0.08); break;
        case 'restore':  tone(330, 0, 0.05); tone(523, 0.04, 0.08); break;
        case 'error':    tone(180, 0, 0.12, 'sawtooth', 0.22); tone(150, 0.1, 0.15, 'sawtooth', 0.2); break;
        case 'notify':   tone(880, 0, 0.08); tone(1047, 0.07, 0.1); break;
        case 'startup':
            tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.2); tone(1047, 0.36, 0.3);
            break;
    }
}
