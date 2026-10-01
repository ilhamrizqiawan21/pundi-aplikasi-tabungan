import { BrowserWindow, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  // Blokir pembukaan jendela baru (NFR-07)
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Cegah navigasi di luar origin yang sah
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isDevServer =
        process.env.VITE_DEV_SERVER_URL &&
        parsed.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin;
      const isAppProtocol = parsed.protocol === 'file:' || parsed.protocol === 'pundi-app:';
      if (!isDevServer && !isAppProtocol) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow = win;
  return win;
}
