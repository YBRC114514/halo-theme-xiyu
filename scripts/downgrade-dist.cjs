/* Downgrade historical theme packages into one continuous 1.0.x series.
 * Only the version string inside theme.yaml / package.json is rewritten; every other
 * byte of the historical build is preserved. Originals are moved to dist/_legacy/.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const archiver = require('archiver');

const DIST = 'D:/WorkBuddy/Work/halo-theme-azure-isle/theme-azure-isle/dist';
const LEGACY = path.join(DIST, '_legacy');
const TMP = path.join(DIST, '_repack');

/* historical file -> [new version, new file name] */
const MAP = [
  ['theme-azure-isle-1.1.0.zip', '1.0.2'],
  ['theme-azure-isle-1.2.0.zip', '1.0.3'],
  ['theme-azure-isle-1.3.0.zip', '1.0.4'],
];

function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (fs.statSync(abs).isDirectory()) {
      out.push({ abs, rel: rel + '/', dir: true });
      out.push(...walk(abs, base));
    } else {
      out.push({ abs, rel, dir: false });
    }
  }
  return out;
}

function zipDir(srcDir, destZip) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destZip);
    const archive = archiver('zip', { zlib: { level: 6 } });
    out.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(out);
    for (const entry of walk(srcDir)) {
      if (entry.dir) continue;
      archive.file(entry.abs, { name: entry.rel, mode: 0o644 });
    }
    archive.finalize();
  });
}

(async () => {
  fs.mkdirSync(LEGACY, { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true });

  for (const [file, version] of MAP) {
    const src = path.join(DIST, file);
    if (!fs.existsSync(src)) {
      console.log('SKIP missing', file);
      continue;
    }
    const work = path.join(TMP, file.replace(/\.zip$/, ''));
    fs.mkdirSync(work, { recursive: true });
    execFileSync('unzip', ['-qq', '-o', src, '-d', work]);

    const themeYaml = path.join(work, 'theme.yaml');
    let yaml = fs.readFileSync(themeYaml, 'utf8');
    const before = (yaml.match(/^\s{2}version:\s*(.+)$/m) || [])[1];
    yaml = yaml.replace(/^(\s{2}version:\s*).+$/m, `$1${version}`);
    fs.writeFileSync(themeYaml, yaml, 'utf8');

    const pkg = path.join(work, 'package.json');
    if (fs.existsSync(pkg)) {
      const p = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      p.version = version;
      fs.writeFileSync(pkg, JSON.stringify(p, null, 2) + '\n', 'utf8');
    }

    const dest = path.join(DIST, `theme-azure-isle-${version}.zip`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    await zipDir(work, dest);
    const size = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`${file} (${before}) -> ${path.basename(dest)} :: ${size} KB`);
    fs.renameSync(src, path.join(LEGACY, file));
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\nremaining dist:');
  for (const f of fs.readdirSync(DIST).sort()) {
    const s = fs.statSync(path.join(DIST, f));
    console.log(' ', f, s.isDirectory() ? '<dir>' : (s.size / 1024).toFixed(1) + ' KB');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
