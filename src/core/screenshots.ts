// Хранилище скриншотов сайтов в chrome.storage.local (ключи ss_<url>),
// плюс миграции блобов из localStorage (фон, аватар) — фикс аудита #3.

import { SS_PREFIX } from './keys';
import { links, saveLinks } from './state';
import type { LinkItem } from './types';

export function screenshotKey(url: string): string {
    return SS_PREFIX + url;
}

function hasChromeStorage(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage;
}

export function saveScreenshot(url: string, dataUrl: string): void {
    if (hasChromeStorage()) {
        chrome.storage.local.set({ [screenshotKey(url)]: dataUrl }, () => {
            if (chrome.runtime.lastError) console.warn('[XP] скриншот не сохранён:', chrome.runtime.lastError.message);
        });
    }
}

export function deleteScreenshot(url: string): void {
    if (hasChromeStorage()) chrome.storage.local.remove(screenshotKey(url));
}

/**
 * Загружает скриншоты из chrome.storage.local в in-memory ярлыки.
 * Заодно мигрирует старые base64-скриншоты, застрявшие в localStorage.
 */
export function initScreenshots(callback: () => void): void {
    if (!hasChromeStorage()) { callback(); return; }

    const toMigrate: Record<string, string> = {};
    (function collectOld(items: LinkItem[]): void {
        items.forEach(item => {
            if (item.url && item.screenshot) toMigrate[screenshotKey(item.url)] = item.screenshot;
            if (item.isFolder && item.items) collectOld(item.items);
        });
    })(links);

    function doLoad(): void {
        const urlMap: Record<string, LinkItem> = {};
        links.forEach(item => {
            if (!item.isFolder && item.url) urlMap[screenshotKey(item.url)] = item;
            if (item.isFolder && item.items) {
                item.items.forEach(child => { if (child.url) urlMap[screenshotKey(child.url)] = child; });
            }
        });
        const keys = Object.keys(urlMap);
        if (!keys.length) { callback(); return; }
        chrome.storage.local.get(keys, result => {
            keys.forEach(k => { if (result[k]) urlMap[k].screenshot = result[k] as string; });
            callback();
        });
    }

    if (Object.keys(toMigrate).length > 0) {
        chrome.storage.local.set(toMigrate, () => { saveLinks(); doLoad(); });
    } else {
        doLoad();
    }
}

/**
 * Миграция большого dataURL из localStorage в chrome.storage.local (фикс квоты).
 * Если localKey содержит 'data:...' — переносит значение в chrome.storage.local под storageKey
 * и заменяет localKey на маркер (например 'custom'). Возвращает true, если миграция началась.
 */
export function migrateBlobToChromeStorage(localKey: string, storageKey: string, marker: string): boolean {
    const raw = localStorage.getItem(localKey);
    if (!raw || !raw.startsWith('data:')) return false;
    localStorage.setItem(localKey, marker);
    if (hasChromeStorage()) {
        chrome.storage.local.set({ [storageKey]: raw }, () => {
            if (chrome.runtime.lastError) {
                // Откат: вернуть dataURL на место, чтобы не потерять данные
                localStorage.setItem(localKey, raw);
                console.warn('[XP] миграция ' + localKey + ' не удалась:', chrome.runtime.lastError.message);
            }
        });
    }
    return true;
}

/** Читает блоб, перенесённый миграцией, из chrome.storage.local. */
export function readMigratedBlob(storageKey: string, cb: (dataUrl: string | null) => void): void {
    if (!hasChromeStorage()) { cb(null); return; }
    chrome.storage.local.get(storageKey, result => cb((result[storageKey] as string | undefined) || null));
}
