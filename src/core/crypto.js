/* Cifrado compatible con la versión de escritorio.
 *
 * - scrypt (N=32768, r=8, p=1) para derivar la llave de 32 bytes.
 * - AES-256-GCM para cifrar la llave maestra y los datos.
 * - La contraseña se normaliza a Unicode NFC (misma contraseña con acentos/ñ
 *   en Windows, Linux y Android).
 *
 * scrypt no viene en WebCrypto; se usa scrypt-js cargado como script clásico
 * (window.scrypt) desde vendor/scrypt.js. En Node, los tests inyectan el
 * mismo módulo en globalThis.scrypt.
 */

export const KDF = Object.freeze({ N: 32768, r: 8, p: 1 });
export const FORMAT_VERSION = 1;
export const MIN_PASSWORD_LENGTH = 8;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8ToBytes = (s) => encoder.encode(String(s));
export const bytesToUtf8 = (b) => decoder.decode(b);

export function toHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('hex inválido');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export const randomHex = (n) => toHex(randomBytes(n));

export const normalizeSecret = (s) => String(s == null ? '' : s).normalize('NFC');

/* 160 bits en hexadecimal, en grupos de 4: A1B2-C3D4-... (igual que escritorio). */
export function generateRecoveryKey() {
  return toHex(randomBytes(20)).toUpperCase().match(/.{1,4}/g).join('-');
}

/* La frase se guarda con guiones, pero la llave se deriva de los 40 hex sin guiones. */
export const normalizeRecoveryInput = (s) => String(s || '').toUpperCase().replace(/[^0-9A-F]/g, '');

export async function deriveKey(secret, saltHex) {
  const lib = globalThis.scrypt;
  if (!lib || typeof lib.scrypt !== 'function') {
    throw new Error('scrypt no disponible');
  }
  const password = utf8ToBytes(normalizeSecret(secret));
  const salt = fromHex(saltHex);
  return lib.scrypt(password, salt, KDF.N, KDF.r, KDF.p, 32);
}

async function importAesKey(key, usage) {
  return crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [usage]);
}

/* Devuelve { iv, authTag, ciphertext } en hex, igual que main.js del escritorio. */
export async function encryptBytes(bytes, key) {
  const iv = randomBytes(12);
  const cryptoKey = await importAesKey(key, 'encrypt');
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, bytes));
  const tagLength = 16;
  return {
    iv: toHex(iv),
    authTag: toHex(sealed.slice(sealed.length - tagLength)),
    ciphertext: toHex(sealed.slice(0, sealed.length - tagLength)),
  };
}

export async function decryptBytes(wrapper, key) {
  const iv = fromHex(wrapper.iv);
  const tag = fromHex(wrapper.authTag);
  const ciphertext = fromHex(wrapper.ciphertext);
  const sealed = new Uint8Array(ciphertext.length + tag.length);
  sealed.set(ciphertext, 0);
  sealed.set(tag, ciphertext.length);
  const cryptoKey = await importAesKey(key, 'decrypt');
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, sealed));
}

export async function encryptJson(value, key) {
  return encryptBytes(utf8ToBytes(JSON.stringify(value)), key);
}

export async function decryptJson(wrapper, key) {
  return JSON.parse(bytesToUtf8(await decryptBytes(wrapper, key)));
}

export async function encryptText(text, key) {
  return encryptBytes(utf8ToBytes(text), key);
}

export async function decryptText(wrapper, key) {
  return bytesToUtf8(await decryptBytes(wrapper, key));
}
