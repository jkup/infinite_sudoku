import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
assert(manifest.name === 'Infinite Sudoku', 'manifest name is missing');
assert(manifest.short_name === 'Sudoku', 'manifest short name is missing');
assert(manifest.display === 'standalone', 'PWA must use standalone display');
assert(manifest.start_url === '/' && manifest.scope === '/', 'PWA scope/start URL must be root');
assert(manifest.theme_color && manifest.background_color, 'theme colors are required');

const icons = new Map(manifest.icons.map((icon) => [`${icon.sizes}:${icon.purpose ?? 'any'}`, icon.src]));
assert(icons.has('192x192:any'), '192px install icon is missing');
assert(icons.has('512x512:any'), '512px install icon is missing');
assert(icons.has('512x512:maskable'), 'maskable install icon is missing');

for (const [size, file] of [[192, 'public/pwa-192x192.png'], [512, 'public/pwa-512x512.png'], [512, 'public/pwa-maskable-512x512.png'], [180, 'public/apple-touch-icon.png']]) {
  const png = readFileSync(file);
  assert(png.subarray(1, 4).toString() === 'PNG', `${file} is not a PNG`);
  assert(png.readUInt32BE(16) === size && png.readUInt32BE(20) === size, `${file} has incorrect dimensions`);
}

const serviceWorker = readFileSync('dist/sw.js', 'utf8');
for (const asset of ['index.html', 'manifest.webmanifest', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png']) {
  assert(serviceWorker.includes(asset), `${asset} is not precached for offline use`);
}
assert(readFileSync('dist/_headers', 'utf8').includes('/sw.js'), 'service-worker revalidation header is missing');

console.log('PWA artifact verification passed');
