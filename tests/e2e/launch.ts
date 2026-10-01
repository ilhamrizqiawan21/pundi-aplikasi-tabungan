import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AppSesi {
  app: ElectronApplication;
  page: Page;
  /** Galat halaman dan console.error yang terjadi selama sesi. */
  galat: string[];
  /** Folder data pengguna terisolasi untuk sesi ini. */
  dataDir: string;
  tutup: () => Promise<void>;
}

/** Menjalankan Pundi dengan folder data sementara, sehingga tidak menyentuh data pengguna sungguhan. */
export async function jalankanApp(): Promise<AppSesi> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-'));
  const env = { ...process.env } as Record<string, string>;
  delete env.VITE_DEV_SERVER_URL;
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: ['.', `--user-data-dir=${dataDir}`],
    cwd: process.cwd(),
    env,
  });
  const page = await app.firstWindow();
  const galat: string[] = [];
  page.on('pageerror', (e) => galat.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') galat.push(`console.error: ${m.text()}`);
  });
  // alert() dan confirm() bawaan dijawab otomatis; teksnya disimpan agar bisa diperiksa
  page.on('dialog', (d) => void d.accept());
  await page.waitForLoadState('domcontentloaded');

  return {
    app,
    page,
    galat,
    dataDir,
    tutup: async () => {
      await app.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
