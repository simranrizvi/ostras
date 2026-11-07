import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = () => {
  if (!env.TOKEN_ENCRYPTION_KEY || !/^[a-f\d]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 32-byte hex key before connecting a social account.');
  }
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'hex');
};

export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decrypt(value) {
  const [ivPart, tagPart, encryptedPart] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8');
}
