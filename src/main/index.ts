import { app, BrowserWindow, dialog, Menu, protocol, net, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initDb, closeDb } from './db/index.js';
import { createMainWindow, getMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc/index.js';
import { FileLogger, pasangPenanganCrash } from './logger.js';

import { BackupService } from './services/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bila diberikan argumen user-data-dir (mis. saat pengujian E2E), gunakan folder tersebut untuk isolasi data
const userDirArg = app.commandLine.getSwitchValue('user-data-dir');
if (userDirArg) {
  app.setPath('userData', userDirArg);
}

// Kunci instans tunggal (F7-1): cegah dua proses membuka basis data SQLite bersamaan
const kunciInstans = app.requestSingleInstanceLock();

if (!kunciInstans) {
  app.quit();
} else {
  // Inisialisasi folder data dan logger berkas lokal (NFR-02 & F7-2)
  const userDataDir = path.join(app.getPath('userData'), 'Pundi');
  const logsDir = path.join(userDataDir, 'logs');
  const logger = new FileLogger({ logsDir });
  pasangPenanganCrash(logger);

  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

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
  const backupDir = path.join(userDataDir, 'backups');
  initDb({ dbPath, backupDir });

  // Jalankan cadangan otomatis harian bila memenuhi syarat (F7-3)
  try {
    const backupSvc = new BackupService(backupDir);
    const hasilBackup = backupSvc.jalankanBackupOtomatisJikaPerlu();
    if (hasilBackup.ok && hasilBackup.data.dibuat) {
      logger.info('BACKUP_OTOMATIS_HARIAN', {
        keterangan: `Cadangan otomatis harian dibuat: ${hasilBackup.data.berkas}`,
      });
    }
  } catch {
    // Gagal membuat cadangan harian tidak boleh membatalkan peluncuran aplikasi
  }

  // Daftarkan penanganan protokol pundi-app
  protocol.handle('pundi-app', (request) => {
    const url = new URL(request.url);
    const relativePath = url.pathname.replace(/^\//, '');
    const distPath = path.join(__dirname, '../../dist', relativePath || 'index.html');
    return net.fetch(pathToFileURL(distPath).toString());
  });

  // Daftarkan handler IPC
  registerIpcHandlers({
    backupDir: path.join(userDataDir, 'backups'),
    kunciDir: userDataDir,
    dataDir: userDataDir,
    logger,
  });

  // Buat jendela utama
  createMainWindow(logger);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(logger);
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
  logger.error('BOOTSTRAP_ERROR', { keterangan: (err as Error)?.name || 'Error' });
  console.error('Gagal menjalankan aplikasi Pundi:', err);
  dialog.showErrorBox(
    'Pundi Tidak Dapat Dibuka',
    'Aplikasi gagal disiapkan. Data Anda tidak diubah. Silakan tutup lalu buka kembali aplikasi, dan hubungi pendamping bila masalah berlanjut.'
  );
  app.quit();
});
}
