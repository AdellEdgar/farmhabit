import sodium from 'libsodium-wrappers-sumo';

// Envoltorio mínimo sobre libsodium. NO implementar primitivas propias:
// solo Argon2id (crypto_pwhash) y XChaCha20-Poly1305 (AEAD IETF).

export const KEY_BYTES = 32;
export const SALT_BYTES = 16;
export const NONCE_BYTES = 24;

export interface KdfParams {
  opsLimit: number;
  memLimitBytes: number;
}

/** Parámetros de producción: 3 pasadas, 64 MiB (asumible en un Android medio). */
export const PRODUCTION_KDF: KdfParams = { opsLimit: 3, memLimitBytes: 64 * 1024 * 1024 };

/** Límites aceptados al LEER un archivo (evita que uno malicioso agote la memoria). */
export const KDF_LIMITS = {
  minOps: 1,
  maxOps: 20,
  minMem: 8 * 1024,
  maxMem: 1024 * 1024 * 1024,
};

export class DecryptionError extends Error {
  constructor() {
    // Nunca incluir la contraseña ni datos del archivo en el mensaje.
    super('Contraseña incorrecta o archivo dañado');
    this.name = 'DecryptionError';
  }
}

export async function ready(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

export async function randomBytes(n: number): Promise<Uint8Array> {
  return (await ready()).randombytes_buf(n);
}

/** Deriva una clave de 32 bytes con Argon2id. */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  const s = await ready();
  if (salt.length !== SALT_BYTES) throw new Error('Salt de longitud incorrecta');
  return s.crypto_pwhash(
    KEY_BYTES,
    password,
    salt,
    params.opsLimit,
    params.memLimitBytes,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export async function encrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
  nonce?: Uint8Array,
): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
  const s = await ready();
  const n = nonce ?? s.randombytes_buf(NONCE_BYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, n, key);
  return { nonce: n, ciphertext };
}

/** Descifra y verifica. Cualquier fallo (clave, datos, AAD) → DecryptionError. */
export async function decrypt(
  key: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
  nonce: Uint8Array,
): Promise<Uint8Array> {
  const s = await ready();
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, key);
  } catch {
    throw new DecryptionError();
  }
}

/** Borra una clave de memoria en cuanto deja de hacer falta. */
export async function wipe(bytes: Uint8Array): Promise<void> {
  (await ready()).memzero(bytes);
}

export async function toBase64(bytes: Uint8Array): Promise<string> {
  const s = await ready();
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}

export async function fromBase64(text: string): Promise<Uint8Array> {
  const s = await ready();
  return s.from_base64(text, s.base64_variants.ORIGINAL);
}
