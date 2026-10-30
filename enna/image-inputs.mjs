import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const enna = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(enna);
const output = path.join(enna, 'target/image');
rmSync(output, { recursive: true, force: true });
mkdirSync(path.join(output, 'libs'), { recursive: true });
const bundles = path.join(root, 'dist/umd');
const files = readdirSync(bundles).filter(file => /^lib-jitsi-meet[\w.-]+$/.test(file)).sort();
if (!files.includes('lib-jitsi-meet.min.js') || !files.includes('lib-jitsi-meet.min.map')) {
    throw new Error('The tested UMD bundle and source map are required');
}
const checksums = [];
for (const file of files) {
    const input = path.join(bundles, file);
    copyFileSync(input, path.join(output, 'libs', file));
    checksums.push(`${createHash('sha256').update(readFileSync(input)).digest('hex')}  libs/${file}`);
}
const bundleSha256 = createHash('sha256').update(readFileSync(path.join(bundles, 'lib-jitsi-meet.min.js'))).digest('hex');
const metadata = {
    upstream: '7d14f385435a8bb11a4c0cfc7015e18cf19b7841',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    repository: 'https://github.com/enna-systems/lib-jitsi-meet',
    bundleSha256,
    baseImage: 'ghcr.io/jitsi/web:stable-11248@sha256:615d9882b7bc2bc0b648fb48c153ce2b9c503f37a15e6aaf4f1c8e40f5cf8ca4',
    node: process.version,
    checks: ['eslint-and-types', 'karma-native', 'karma-polyfill', 'webpack-and-typescript']
};
writeFileSync(path.join(output, 'enna-web-build.json'), JSON.stringify(metadata, null, 2) + '\n');
writeFileSync(path.join(output, 'cache-version'), `enna-p2p-freeze-${bundleSha256.slice(0, 16)}\n`);
writeFileSync(path.join(output, 'SHA256SUMS'), checksums.join('\n') + '\n');
console.log(`Verified image inputs: ${output}; library SHA-256 ${bundleSha256}`);
