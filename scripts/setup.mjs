import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, '.env');
if (!fs.existsSync(target)) {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  fs.writeFileSync(
    target,
    example
      .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
      .replace(
        /^TOKEN_ENCRYPTION_KEY=.*$/m,
        `TOKEN_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`,
      ),
    { mode: 0o600, flag: 'wx' },
  );
  console.info('Created .env with random session and encryption secrets.');
} else console.info('Kept existing .env.');
const webTarget = path.join(root, 'frontend/.env.local');
if (!fs.existsSync(webTarget)) {
  fs.copyFileSync(path.join(root, 'frontend/.env.example'), webTarget, fs.constants.COPYFILE_EXCL);
  console.info('Created frontend/.env.local.');
} else console.info('Kept existing frontend/.env.local.');
console.info('Review the environment settings, start MongoDB, then run npm run dev.');
