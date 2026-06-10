import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const packageName = pkg.name;
const releaseName = `${packageName}-v${version}`;
const distDir = join(root, 'dist');
const stageDir = join(distDir, releaseName);
const zipName = `${releaseName}.zip`;
const zipPath = join(distDir, zipName);
const sumsPath = join(distDir, 'SHA256SUMS.txt');

const releaseFiles = [
  'manifest.json',
  'package.json',
  'README.md',
  'PRIVACY.md',
  'SECURITY.md',
  'LICENSE',
  'src'
];

function copyReleaseFiles() {
  rmSync(stageDir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });
  mkdirSync(stageDir, { recursive: true });

  for (const file of releaseFiles) {
    const from = join(root, file);
    if (!existsSync(from)) throw new Error(`Missing release file: ${file}`);
    cpSync(from, join(stageDir, file), { recursive: true });
  }
}

function createZip() {
  const result = spawnSync('zip', ['-r', '-X', zipName, releaseName], {
    cwd: distDir,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('zip failed');
  }
}

function writeChecksum() {
  const digest = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
  writeFileSync(sumsPath, `${digest}  ${zipName}\n`);
  return digest;
}

copyReleaseFiles();
createZip();
const digest = writeChecksum();

console.log(`created ${zipPath}`);
console.log(`created ${sumsPath}`);
console.log(`sha256 ${digest}`);
