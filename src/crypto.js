import crypto from 'node:crypto';

const key = Buffer.from(process.env.TOKEN_ENC_KEY || '', 'hex');

export function assertKey() {
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 64 hex characters (openssl rand -hex 32)');
}

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decrypt(s) {
  const b = Buffer.from(s, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
