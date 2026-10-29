import { z } from 'zod';
import {
  decrypt,
  deriveKey,
  encrypt,
  fromBase64,
  PRODUCTION_KDF,
  randomBytes,
  SALT_BYTES,
  toBase64,
  type KdfParams,
} from '../crypto/sodium';
import { newId } from '../util/ids';
import {
  argon2KdfSchema,
  MIN_PASSWORD_LENGTH,
  PasswordTooShortError,
  type VaultKey,
} from './format';

// Baúl de sincronización: un archivo `farmhabit-vault.json` en el almacenamiento
// remoto (p. ej. Google Drive) con la sal de Argon2id y una comprobación
// cifrada. Todos los dispositivos derivan la MISMA clave de la frase secreta y
// la guardan en el llavero del sistema: así cifran sin volver a pedirla.
// El remoto solo ve datos cifrados.

export const VAULT_FILE = 'farmhabit-vault.json';
const CHECK_TEXT = 'farmhabit-vault-ok';

export interface RemoteFile {
  name: string;
  /** Marca de modificación del remoto (ms); cambia cada vez que se reescribe. */
  modifiedAt: number;
}

/** Almacenamiento remoto mínimo: una carpeta plana de archivos. */
export interface RemoteStore {
  list(): Promise<RemoteFile[]>;
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, data: Uint8Array): Promise<void>;
}

export class VaultExistsError extends Error {
  constructor() {
    super('Ya hay una sincronización creada en esta cuenta. Únete a ella con su frase secreta.');
    this.name = 'VaultExistsError';
  }
}

export class NoVaultError extends Error {
  constructor() {
    super('Todavía no hay ninguna sincronización creada en esta cuenta.');
    this.name = 'NoVaultError';
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('La frase secreta no es correcta');
    this.name = 'WrongPassphraseError';
  }
}

const vaultSchema = z.object({
  format: z.literal('farmhabit-vault'),
  version: z.literal(1),
  vaultId: z.string().min(1).max(100),
  createdAt: z.string(),
  kdf: argon2KdfSchema,
  check: z.object({ nonce: z.string(), ciphertext: z.string() }),
});

export type VaultInfo = z.infer<typeof vaultSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function readVault(store: RemoteStore): Promise<VaultInfo | null> {
  const bytes = await store.read(VAULT_FILE);
  if (!bytes) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(decoder.decode(bytes));
  } catch {
    throw new Error('El archivo de sincronización remoto está dañado');
  }
  const parsed = vaultSchema.safeParse(raw);
  if (!parsed.success) throw new Error('El archivo de sincronización remoto no es válido');
  return parsed.data;
}

/** Crea el baúl con una frase secreta nueva (primer dispositivo). */
export async function createVault(
  store: RemoteStore,
  passphrase: string,
  opts: { now: number; kdf?: KdfParams },
): Promise<VaultKey> {
  if (passphrase.length < MIN_PASSWORD_LENGTH) throw new PasswordTooShortError();
  if (await readVault(store)) throw new VaultExistsError();
  const kdf = opts.kdf ?? PRODUCTION_KDF;
  const vaultId = newId();
  const salt = await randomBytes(SALT_BYTES);
  const key = await deriveKey(passphrase, salt, kdf);
  const { nonce, ciphertext } = await encrypt(
    key,
    encoder.encode(CHECK_TEXT),
    encoder.encode(vaultId),
  );
  const info: VaultInfo = {
    format: 'farmhabit-vault',
    version: 1,
    vaultId,
    createdAt: new Date(opts.now).toISOString(),
    kdf: { alg: 'argon2id13', ...kdf, salt: await toBase64(salt) },
    check: { nonce: await toBase64(nonce), ciphertext: await toBase64(ciphertext) },
  };
  await store.write(VAULT_FILE, encoder.encode(JSON.stringify(info)));
  return { vaultId, key };
}

/** Deriva la clave de un baúl existente y comprueba la frase secreta. */
export async function unlockVault(store: RemoteStore, passphrase: string): Promise<VaultKey> {
  const info = await readVault(store);
  if (!info) throw new NoVaultError();
  const key = await deriveKey(passphrase, await fromBase64(info.kdf.salt), info.kdf);
  try {
    const text = await decrypt(
      key,
      await fromBase64(info.check.ciphertext),
      encoder.encode(info.vaultId),
      await fromBase64(info.check.nonce),
    );
    if (decoder.decode(text) !== CHECK_TEXT) throw new WrongPassphraseError();
  } catch {
    throw new WrongPassphraseError();
  }
  return { vaultId: info.vaultId, key };
}

/** Clave del baúl ↔ texto para guardarla en el llavero del sistema. */
export async function serializeVaultKey(v: VaultKey): Promise<string> {
  return JSON.stringify({ vaultId: v.vaultId, key: await toBase64(v.key) });
}

export async function parseVaultKey(text: string): Promise<VaultKey> {
  const raw = JSON.parse(text) as { vaultId: string; key: string };
  return { vaultId: raw.vaultId, key: await fromBase64(raw.key) };
}
