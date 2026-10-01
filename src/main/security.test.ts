import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isTrustedUrl, isTrustedSender, type TrustedConfig } from './security.js';

const indexFile = path.resolve('dist', 'index.html');
const indexUrl = pathToFileURL(indexFile).toString();
const prod: TrustedConfig = { indexFile };
const dev: TrustedConfig = { indexFile, devServerUrl: 'http://localhost:5173/' };

describe('isTrustedUrl (NFR-07)', () => {
  it('menerima index.html aplikasi, juga dengan hash atau query', () => {
    expect(isTrustedUrl(indexUrl, prod)).toBe(true);
    expect(isTrustedUrl(`${indexUrl}#/siswa`, prod)).toBe(true);
    expect(isTrustedUrl(`${indexUrl}?x=1`, prod)).toBe(true);
  });

  it('menolak berkas lokal lain, situs web, dan URL rusak', () => {
    expect(isTrustedUrl(pathToFileURL(path.resolve('dist', 'lain.html')).toString(), prod)).toBe(false);
    expect(isTrustedUrl('file:///C:/Windows/win.ini', prod)).toBe(false);
    expect(isTrustedUrl('https://contoh.com/', prod)).toBe(false);
    expect(isTrustedUrl('http://localhost:5173/', prod)).toBe(false);
    expect(isTrustedUrl('bukan url', prod)).toBe(false);
    expect(isTrustedUrl('', prod)).toBe(false);
  });

  it('server dev hanya dipercaya bila dikonfigurasi, dan dicocokkan per origin', () => {
    expect(isTrustedUrl('http://localhost:5173/index.html', dev)).toBe(true);
    expect(isTrustedUrl('http://localhost:5173.jahat.com/', dev)).toBe(false);
    expect(isTrustedUrl('http://localhost:5174/', dev)).toBe(false);
    expect(isTrustedUrl('http://localhost:5173@jahat.com/', dev)).toBe(false);
  });
});

describe('isTrustedSender', () => {
  it('menolak tanpa frame, frame anak, atau URL tidak sah', () => {
    expect(isTrustedSender(null, prod)).toBe(false);
    expect(isTrustedSender(undefined, prod)).toBe(false);
    expect(isTrustedSender({ url: indexUrl, parent: {} }, prod)).toBe(false);
    expect(isTrustedSender({ url: 'https://contoh.com/', parent: null }, prod)).toBe(false);
  });

  it('menerima frame teratas yang memuat halaman aplikasi', () => {
    expect(isTrustedSender({ url: indexUrl, parent: null }, prod)).toBe(true);
  });
});
