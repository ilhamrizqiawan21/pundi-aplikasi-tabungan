// Menyiapkan binary native better-sqlite3 untuk satu target: `node` (uji) atau `electron` (paket).
// Kedua target memakai ABI berbeda, jadi binary di node_modules harus ditukar sebelum dipakai.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const target = process.argv[2];
if (target !== 'node' && target !== 'electron') {
  console.error('Pemakaian: node scripts/native.mjs <node|electron>');
  process.exit(2);
}

const modDir = path.dirname(require.resolve('better-sqlite3/package.json'));
const marker = path.join(modDir, 'build', 'Release', '.pundi-target');
const electronVersion = require('electron/package.json').version;
const wanted = target === 'node' ? `node-abi${process.versions.modules}` : `electron-${electronVersion}`;

if (target === 'node' && Number(process.versions.node.split('.')[0]) !== 22) {
  console.error(
    `Pundi memakai Node 22 (LTS), sedangkan ini Node ${process.versions.node}. ` +
      'Gunakan Node 22 agar tersedia binary better-sqlite3 siap pakai.'
  );
  process.exit(1);
}

const current = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '';
if (current === wanted) {
  console.log(`better-sqlite3 sudah untuk ${wanted}.`);
  process.exit(0);
}

const args = ['--force', '--arch', process.arch, '--platform', process.platform];
if (target === 'electron') args.push('--runtime', 'electron', '--target', electronVersion);

const bin = require.resolve('prebuild-install/bin.js');
const res = spawnSync(process.execPath, [bin, ...args], { cwd: modDir, stdio: 'inherit' });
if (res.status !== 0) {
  console.error(`Gagal menyiapkan better-sqlite3 untuk ${wanted}.`);
  process.exit(res.status ?? 1);
}

// Hapus penanda lama @electron/rebuild agar tidak menyesatkan, lalu catat target saat ini.
fs.rmSync(path.join(modDir, 'build', 'Release', '.forge-meta'), { force: true });
fs.writeFileSync(marker, wanted);
console.log(`better-sqlite3 siap untuk ${wanted}.`);
