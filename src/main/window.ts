import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTrustedUrl, type TrustedConfig } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

const iconFile = path.join(__dirname, '../../build/icon.png');
const indexFile = path.join(__dirname, '../../dist/index.html');

/** Konfigurasi URL sah; server dev hanya dipercaya pada aplikasi yang belum dipaketkan. */
export function trustedConfig(): TrustedConfig {
  return {
    indexFile,
    devServerUrl: app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL,
  };
}

export function createMainWindow(): BrowserWindow {
  // Blokir semua permintaan izin (NFR-01, NFR-07)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const preloadPath = path.join(__dirname, '../preload/index.cjs');

  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    icon: iconFile,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      preload: preloadPath,
    },
  });

  if (app.isPackaged) win.setMenuBarVisibility(false);

  // Blokir pembukaan jendela baru (NFR-07)
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Cegah navigasi ke luar halaman aplikasi
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedUrl(navigationUrl, trustedConfig())) {
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const { devServerUrl } = trustedConfig();
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(indexFile);
  }

  mainWindow = win;
  return win;
}
