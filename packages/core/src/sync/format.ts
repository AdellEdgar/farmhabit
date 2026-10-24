import { z } from 'zod';
import { COLLECTION_NAMES, COLLECTIONS } from '../model/collections';
import type { Dataset } from '../model/collections';
import {
  decrypt,
  deriveKey,
  encrypt,
  fromBase64,
  KDF_LIMITS,
  NONCE_BYTES,
  PRODUCTION_KDF,
  randomBytes,
  SALT_BYTES,
  toBase64,
  wipe,
} from '../crypto/sodium';
import type { KdfParams } from '../crypto/sodium';

// Formato del archivo cifrado .agx (ver CLAUDE.md):
//   [4 B] "AGX1" | [4 B] longitud cabecera (uint32 LE) | [N B] cabecera JSON | ciphertext
// La AAD son los bytes exactos de magic + longitud + cabecera.

export const MAGIC = 'AGX1';
export const CURRENT_FORMAT_VERSION = 1;
const PREFIX_BYTES = 8;
const MAX_HEADER_BYTES = 64 * 1024;
export const MIN_PASSWORD_LENGTH = 8;

export class InvalidFileError extends Error {
  constructor(reason: string) {
    super(`El archivo no es una copia válida de FarmHabit (${reason})`);
    this.name = 'InvalidFileError';
  }
}

export class UnsupportedVersionError extends Error {
  constructor(readonly version: number) {
    super(
      `El archivo es de una versión más nueva de FarmHabit (formato ${version}). Actualiza la app.`,
    );
    this.name = 'UnsupportedVersionError';
  }
}

export class PayloadValidationError extends Error {
  constructor(readonly issues: string[]) {
    super('El contenido del archivo no tiene el formato esperado');
    this.name = 'PayloadValidationError';
  }
}

export class PasswordTooShortError extends Error {
  constructor() {
    super(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    this.name = 'PasswordTooShortError';
  }
}

const headerSchema = z.object({
  format: z.literal('farmhabit-export'),
  formatVersion: z.number().int().positive(),
  createdAt: z.string(),
  deviceId: z.string().max(100),
  kdf: z.object({
    alg: z.literal('argon2id13'),
    opsLimit: z.number().int().min(KDF_LIMITS.minOps).max(KDF_LIMITS.maxOps),
    memLimitBytes: z.number().int().min(KDF_LIMITS.minMem).max(KDF_LIMITS.maxMem),
    salt: z.string(),
  }),
  aead: z.object({ alg: z.literal('xchacha20poly1305-ietf'), nonce: z.string() }),
  compression: z.literal('none'),
});

export type ExportHeader = z.infer<typeof headerSchema>;

export interface ExportPayload {
  formatVersion: number;
  schemaVersion: number;
  exportedAt: number;
  sourceDeviceId: string;
  collections: Dataset;
  /** Fase 6: clave de notas privadas envuelta. */
  privateVault: unknown;
}

const collectionsSchema = z.object(
  Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, z.array(COLLECTIONS[name]).default([])]),
  ) as { [K in keyof typeof COLLECTIONS]: z.ZodDefault<z.ZodArray<(typeof COLLECTIONS)[K]>> },
);

const payloadSchema = z.object({
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().nonnegative(),
  exportedAt: z.number().int().nonnegative(),
  sourceDeviceId: z.string(),
  collections: collectionsSchema,
  privateVault: z.unknown().default(null),
});

/** Migraciones del contenido: MIGRATIONS[v] convierte un payload v en v+1. */
export type PayloadMigrations = Record<
  number,
  (payload: Record<string, unknown>) => Record<string, unknown>
>;
export const PAYLOAD_MIGRATIONS: PayloadMigrations = {};

export interface FormatOptions {
  kdf?: KdfParams;
  /** Solo para tests: simular otras versiones del formato. */
  formatVersion?: number;
  migrations?: PayloadMigrations;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export async function encodeExport(
  payload: ExportPayload,
  password: string,
  opts: FormatOptions & { deviceId: string; now: number },
): Promise<Uint8Array> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new PasswordTooShortError();
  const kdf = opts.kdf ?? PRODUCTION_KDF;
  const formatVersion = opts.formatVersion ?? CURRENT_FORMAT_VERSION;
  const salt = await randomBytes(SALT_BYTES);
  const nonce = await randomBytes(NONCE_BYTES);

  const header: ExportHeader = {
    format: 'farmhabit-export',
    formatVersion,
    createdAt: new Date(opts.now).toISOString(),
    deviceId: opts.deviceId,
    kdf: { alg: 'argon2id13', ...kdf, salt: await toBase64(salt) },
    aead: { alg: 'xchacha20poly1305-ietf', nonce: await toBase64(nonce) },
    compression: 'none',
  };
  const headerBytes = encoder.encode(JSON.stringify(header));
  const prefix = new Uint8Array(PREFIX_BYTES + headerBytes.length);
  prefix.set(encoder.encode(MAGIC), 0);
  new DataView(prefix.buffer).setUint32(4, headerBytes.length, true);
  prefix.set(headerBytes, PREFIX_BYTES);

  const key = await deriveKey(password, salt, kdf);
  try {
    const plaintext = encoder.encode(JSON.stringify({ ...payload, formatVersion }));
    const { ciphertext } = await encrypt(key, plaintext, prefix, nonce);
    const out = new Uint8Array(prefix.length + ciphertext.length);
    out.set(prefix, 0);
    out.set(ciphertext, prefix.length);
    return out;
  } finally {
    await wipe(key);
  }
}

/** Lee y valida la cabecera sin descifrar (no necesita contraseña). */
export function readHeader(bytes: Uint8Array): { header: ExportHeader; aad: Uint8Array } {
  if (bytes.length < PREFIX_BYTES) throw new InvalidFileError('demasiado corto');
  if (decoder.decode(bytes.subarray(0, 4)) !== MAGIC) {
    throw new InvalidFileError('firma desconocida');
  }
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  if (length === 0 || length > MAX_HEADER_BYTES || PREFIX_BYTES + length > bytes.length) {
    throw new InvalidFileError('cabecera truncada');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(decoder.decode(bytes.subarray(PREFIX_BYTES, PREFIX_BYTES + length)));
  } catch {
    throw new InvalidFileError('cabecera ilegible');
  }
  // La versión se comprueba antes que el resto: una versión futura puede
  // traer campos que esta app no conoce.
  const version = (raw as { formatVersion?: unknown } | null)?.formatVersion;
  if (typeof version === 'number' && version > CURRENT_FORMAT_VERSION) {
    throw new UnsupportedVersionError(version);
  }
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidFileError('cabecera no válida');
  return { header: parsed.data, aad: bytes.subarray(0, PREFIX_BYTES + length) };
}

export async function decodeExport(
  bytes: Uint8Array,
  password: string,
  opts: Pick<FormatOptions, 'migrations'> & { currentVersion?: number } = {},
): Promise<{ header: ExportHeader; payload: ExportPayload }> {
  const current = opts.currentVersion ?? CURRENT_FORMAT_VERSION;
  const { header, aad } = readHeader(bytes);
  if (header.formatVersion > current) throw new UnsupportedVersionError(header.formatVersion);

  let salt: Uint8Array;
  let nonce: Uint8Array;
  try {
    salt = await fromBase64(header.kdf.salt);
    nonce = await fromBase64(header.aead.nonce);
  } catch {
    throw new InvalidFileError('cabecera no válida');
  }
  if (salt.length !== SALT_BYTES || nonce.length !== NONCE_BYTES) {
    throw new InvalidFileError('cabecera no válida');
  }
  const ciphertext = bytes.subarray(aad.length);

  const key = await deriveKey(password, salt, header.kdf);
  let plaintext: Uint8Array;
  try {
    plaintext = await decrypt(key, ciphertext, aad, nonce);
  } finally {
    await wipe(key);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(decoder.decode(plaintext)) as Record<string, unknown>;
  } catch {
    throw new PayloadValidationError(['JSON ilegible']);
  }

  const migrations = opts.migrations ?? PAYLOAD_MIGRATIONS;
  for (let v = header.formatVersion; v < current; v++) {
    const step = migrations[v];
    if (!step) throw new PayloadValidationError([`Falta la migración del formato ${v} a ${v + 1}`]);
    raw = { ...step(raw), formatVersion: v + 1 };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PayloadValidationError(
      parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  return { header, payload: parsed.data as ExportPayload };
}
