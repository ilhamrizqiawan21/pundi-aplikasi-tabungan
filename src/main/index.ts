import { app, BrowserWindow, protocol, net } from 'electron';
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

async function bootstrap() {
  await app.whenReady();

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
  registerIpcHandlers();

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
