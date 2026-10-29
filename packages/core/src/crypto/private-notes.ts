import { z } from 'zod';
import { argon2KdfSchema, MIN_PASSWORD_LENGTH, PasswordTooShortError } from '../sync/format';
import { WrongPassphraseError } from '../sync/vault';
import {
  decrypt,
  deriveKey,
  encrypt,
  fromBase64,
  KEY_BYTES,
  NONCE_BYTES,
  PRODUCTION_KDF,
  randomBytes,
  SALT_BYTES,
  toBase64,
  wipe,
  type KdfParams,
} from './sodium';

// Notas privadas: una clave aleatoria (DEK) cifra el contenido de cada nota.
// La DEK se guarda "envuelta" (cifrada) con una clave derivada de la
// contraseña de notas privadas con Argon2id. Así:
//  - cambiar la contraseña solo reenvuelve la DEK, no recifra las notas;
//  - la DEK envuelta se sincroniza (ajuste `privateNotes.vault`) y los demás
//    dispositivos la abren con la misma contraseña.
// En los archivos exportados, las notas privadas van doblemente cifradas.

export const PRIVATE_VAULT_SETTING = 'privateNotes.vault';

const privateVaultSchema = z.object({
  version: z.literal(1),
  kdf: argon2KdfSchema,
  wrapped: z.object({ nonce: z.string(), ciphertext: z.string() }),
});

export type PrivateVaultInfo = z.infer<typeof privateVaultSchema>;

export interface PrivateContent {
  title: string;
  content: string;
  plainText: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const WRAP_AAD = encoder.encode('farmhabit-private-notes-v1');

export function parsePrivateVault(json: string): PrivateVaultInfo {
  return privateVaultSchema.parse(JSON.parse(json));
}

async function wrap(dek: Uint8Array, password: string, kdf: KdfParams): Promise<PrivateVaultInfo> {
  const salt = await randomBytes(SALT_BYTES);
  const kek = await deriveKey(password, salt, kdf);
  try {
    const { nonce, ciphertext } = await encrypt(kek, dek, WRAP_AAD);
    return {
      version: 1,
      kdf: { alg: 'argon2id13', ...kdf, salt: await toBase64(salt) },
      wrapped: { nonce: await toBase64(nonce), ciphertext: await toBase64(ciphertext) },
    };
  } finally {
    await wipe(kek);
  }
}

/** Crea la caja de notas privadas. Devuelve la info para guardar y la DEK. */
export async function createPrivateVault(
  password: string,
  kdf: KdfParams = PRODUCTION_KDF,
): Promise<{ info: PrivateVaultInfo; dek: Uint8Array }> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new PasswordTooShortError();
  const dek = await randomBytes(KEY_BYTES);
  return { info: await wrap(dek, password, kdf), dek };
}

/** Abre la caja con la contraseña. WrongPassphraseError si no es correcta. */
export async function unlockPrivateVault(
  info: PrivateVaultInfo,
  password: string,
): Promise<Uint8Array> {
  const kek = await deriveKey(password, await fromBase64(info.kdf.salt), info.kdf);
  try {
    return await decrypt(
      kek,
      await fromBase64(info.wrapped.ciphertext),
      WRAP_AAD,
      await fromBase64(info.wrapped.nonce),
    );
  } catch {
    throw new WrongPassphraseError();
  } finally {
    await wipe(kek);
  }
}

/** Cambia la contraseña sin tocar las notas (solo se reenvuelve la DEK). */
export async function changePrivatePassword(
  info: PrivateVaultInfo,
  oldPassword: string,
  newPassword: string,
  kdf: KdfParams = PRODUCTION_KDF,
): Promise<PrivateVaultInfo> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new PasswordTooShortError();
  const dek = await unlockPrivateVault(info, oldPassword);
  try {
    return await wrap(dek, newPassword, kdf);
  } finally {
    await wipe(dek);
  }
}

/** Cifra el contenido de una nota. La AAD es el id: un blob no vale para otra nota. */
export async function encryptNoteContent(
  dek: Uint8Array,
  noteId: string,
  content: PrivateContent,
): Promise<string> {
  const { nonce, ciphertext } = await encrypt(
    dek,
    encoder.encode(JSON.stringify(content)),
    encoder.encode(noteId),
  );
  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, nonce.length);
  return toBase64(out);
}

export async function decryptNoteContent(
  dek: Uint8Array,
  noteId: string,
  blob: string,
): Promise<PrivateContent> {
  const bytes = await fromBase64(blob);
  const plain = await decrypt(
    dek,
    bytes.subarray(NONCE_BYTES),
    encoder.encode(noteId),
    bytes.subarray(0, NONCE_BYTES),
  );
  const parsed = JSON.parse(decoder.decode(plain)) as PrivateContent;
  return {
    title: parsed.title ?? '',
    content: parsed.content ?? '',
    plainText: parsed.plainText ?? '',
  };
}
