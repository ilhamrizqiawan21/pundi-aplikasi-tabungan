import { app, BrowserWindow, Menu, protocol, net, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initDb, closeDb } from './db/index.js';
import { createMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skema custom protocol aman (ARCHITECTURE §3)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pundi-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

/**
 * Aplikasi terpaket tidak memakai menu bawaan Electron: Ctrl+R memuat ulang halaman (isian transaksi hilang) dan
 * View memuat DevTools. Yang disisakan hanya menu Edit agar salin/tempel/urungkan tetap bekerja; bilahnya disembunyikan
 * di window.ts. Saat pengembangan menu bawaan dipertahankan.
 */
function pasangMenuAplikasi(): void {
  if (!app.isPackaged) return;
  const edit: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === 'darwin' ? [{ role: 'appMenu' }, edit] : [edit]));
}

async function bootstrap() {
  await app.whenReady();
  pasangMenuAplikasi();

  // Inisialisasi basis data SQLite di folder data pengguna
  const userDataDir = path.join(app.getPath('userData'), 'Pundi');
  const dbPath = path.join(userDataDir, 'pundi.sqlite');
  initDb({ dbPath });

  // Daftarkan penanganan protokol pundi-app
  protocol.handle('pundi-app', (request) => {
    const url = new URL(request.url);
    const relativePath = url.pathname.replace(/^\//, '');
    const distPath = path.join(__dirname, '../../dist', relativePath || 'index.html');
    return net.fetch(pathToFileURL(distPath).toString());
  });

  // Daftarkan handler IPC
  registerIpcHandlers({ backupDir: path.join(userDataDir, 'backups'), kunciDir: userDataDir });

  // Buat jendela utama
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb();
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDb();
});

bootstrap().catch((err) => {
  console.error('Gagal menjalankan aplikasi Pundi:', err);
  app.quit();
});
