import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import argon2 from 'argon2';

const SALT_LEN = 16;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
    hashLength: KEY_LEN,
    raw: true,
  }) as Buffer;
}

export async function encryptVault(plaintext: Buffer, password: string): Promise<Buffer> {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = await deriveKey(password, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, nonce, ct, tag]);
  } finally {
    key.fill(0);
  }
}

export async function decryptVault(blob: Buffer, password: string): Promise<Buffer> {
  if (blob.length < SALT_LEN + NONCE_LEN + TAG_LEN) throw new Error('vault: malformed blob');
  const salt = blob.subarray(0, SALT_LEN);
  const nonce = blob.subarray(SALT_LEN, SALT_LEN + NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(SALT_LEN + NONCE_LEN, blob.length - TAG_LEN);
  const key = await deriveKey(password, salt);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } finally {
    key.fill(0);
  }
}
