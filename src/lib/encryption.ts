import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/** Values that must never be used as a real key: the built-in dev fallback and the .env.example placeholder. */
const KNOWN_WEAK_KEYS = new Set([
  'default-encryption-key-for-dev!!',
  'your-32-byte-hex-encryption-key-here-generate-with-the-command-above',
]);

function getKey(): Buffer {
  const configured = process.env.ENCRYPTION_KEY;

  // In production, refuse to "encrypt" Stripe keys, OAuth tokens and provider API
  // keys with a key that is written in the source or in .env.example: anyone with
  // the repository could decrypt them. Local development keeps the fallback.
  if (process.env.NODE_ENV === 'production' && (!configured || KNOWN_WEAK_KEYS.has(configured))) {
    throw new Error(
      'ENCRYPTION_KEY is not set to a real secret. Generate one with ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" and set it before running in production.`
    );
  }

  const raw = configured || 'default-encryption-key-for-dev!!';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a string using aes-256-cbc
 * @param text The text to encrypt
 * @returns Encrypted text in format iv:encryptedData
 */
export function encrypt(textToEncrypt: string): string {
  if (!textToEncrypt) return '';

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(textToEncrypt);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts a string encrypted with the encrypt function
 * @param textToDecrypt The encrypted text (iv:encryptedData)
 * @returns Decrypted text
 */
export function decrypt(textToDecrypt: string): string {
  if (!textToDecrypt) return '';
  
  try {
    const textParts = textToDecrypt.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) throw new Error('Invalid format');
    
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
}
