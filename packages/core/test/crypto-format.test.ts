import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecryptionError, deriveKey, PRODUCTION_KDF, SALT_BYTES } from '../src/crypto/sodium';
import { emptyDataset } from '../src/model/collections';
import type { ExportPayload } from '../src/sync/format';
import {
  decodeExport,
  encodeExport,
  InvalidFileError,
  PasswordTooShortError,
  PayloadValidationError,
  readHeader,
  UnsupportedVersionError,
} from '../src/sync/format';
import { exportDatabase } from '../src/sync/service';
import { makeNote, makeTask, openTestDb, TEST_KDF } from './helpers/fixtures';

const PASSWORD = 'correcto caballo batería grapa';
const OPTS = { kdf: TEST_KDF, deviceId: 'dispositivo-test', now: Date.UTC(2026, 9, 24) };

function samplePayload(): ExportPayload {
  const collections = emptyDataset();
  collections.tasks = [
    makeTask({ title: 'Comprar pan 🥖', notes: 'En la panadería de la esquina, señor Ñúñez' }),
  ];
  collections.notes = [
    makeNote({ title: 'Diario', content: '{"type":"doc"}', plainText: 'hoy fue un buen día' }),
  ];
  return {
    formatVersion: 1,
    schemaVersion: 1,
    exportedAt: OPTS.now,
    sourceDeviceId: OPTS.deviceId,
    collections,
    privateVault: null,
  };
}

/** Copia con un bit cambiado en la posición indicada. */
function flipBit(bytes: Uint8Array, index: number): Uint8Array {
  const copy = bytes.slice();
  copy[index] = copy[index]! ^ 0x01;
  return copy;
}

afterEach(() => vi.restoreAllMocks());

describe('cifrado y descifrado', () => {
  it('exportar e importar devuelve exactamente los mismos datos (emojis y ñ incluidos)', async () => {
    const payload = samplePayload();
    const bytes = await encodeExport(payload, PASSWORD, OPTS);
    const { header, payload: decoded } = await decodeExport(bytes, PASSWORD);
    expect(decoded).toEqual(payload);
    expect(header).toMatchObject({
      formatVersion: 1,
      deviceId: OPTS.deviceId,
      compression: 'none',
    });
  });

  it('el texto en claro no aparece en el archivo', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    const raw = Buffer.from(bytes).toString('latin1');
    for (const secret of ['Comprar pan', 'panadería', 'buen día', 'Diario']) {
      expect(raw).not.toContain(secret);
    }
  });

  it('cada exportación usa salt y nonce nuevos (mismos datos → archivos distintos)', async () => {
    const payload = samplePayload();
    const a = await encodeExport(payload, PASSWORD, OPTS);
    const b = await encodeExport(payload, PASSWORD, OPTS);
    const ha = readHeader(a).header;
    const hb = readHeader(b).header;
    expect(ha.kdf.salt).not.toBe(hb.kdf.salt);
    expect(ha.aead.nonce).not.toBe(hb.aead.nonce);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('una contraseña incorrecta da DecryptionError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    await expect(decodeExport(bytes, 'otra contraseña')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('un bit cambiado en el contenido cifrado da DecryptionError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    await expect(decodeExport(flipBit(bytes, bytes.length - 20), PASSWORD)).rejects.toBeInstanceOf(
      DecryptionError,
    );
    // También en el tag de autenticación (últimos 16 bytes).
    await expect(decodeExport(flipBit(bytes, bytes.length - 1), PASSWORD)).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('modificar la cabecera hace fallar el descifrado (va autenticada)', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    const { aad } = readHeader(bytes);
    const text = Buffer.from(aad).toString('utf8');
    const idx = text.indexOf('dispositivo-test');
    // Cambia el deviceId sin romper el JSON: la cabecera sigue siendo legible.
    const tampered = bytes.slice();
    tampered[idx] = 'D'.charCodeAt(0);
    expect(readHeader(tampered).header.deviceId).toBe('Dispositivo-test');
    await expect(decodeExport(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('la contraseña no aparece en errores ni en la consola', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    const err = await decodeExport(bytes, 'contraseña-secreta-mala').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DecryptionError);
    const text = `${String(err)} ${JSON.stringify(err)} ${(err as Error).stack ?? ''}`;
    expect(text).not.toContain('contraseña-secreta-mala');
    expect(text).not.toContain(PASSWORD);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('rechaza contraseñas demasiado cortas al exportar', async () => {
    await expect(encodeExport(samplePayload(), 'corta', OPTS)).rejects.toBeInstanceOf(
      PasswordTooShortError,
    );
  });
});

describe('archivos no válidos', () => {
  it('archivo vacío, truncado o con otra firma da InvalidFileError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    await expect(decodeExport(new Uint8Array(), PASSWORD)).rejects.toBeInstanceOf(InvalidFileError);
    await expect(decodeExport(bytes.slice(0, 30), PASSWORD)).rejects.toBeInstanceOf(
      InvalidFileError,
    );
    const wrongMagic = bytes.slice();
    wrongMagic.set(new TextEncoder().encode('ZIP!'), 0);
    await expect(decodeExport(wrongMagic, PASSWORD)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('cabecera ilegible da InvalidFileError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    const broken = bytes.slice();
    broken[8] = '#'.charCodeAt(0); // primer carácter del JSON
    await expect(decodeExport(broken, PASSWORD)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('el contenido cifrado truncado da DecryptionError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    await expect(decodeExport(bytes.slice(0, bytes.length - 5), PASSWORD)).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('un archivo de una versión más nueva da UnsupportedVersionError', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, { ...OPTS, formatVersion: 2 });
    expect(() => readHeader(bytes)).toThrow(UnsupportedVersionError);
    await expect(decodeExport(bytes, PASSWORD)).rejects.toBeInstanceOf(UnsupportedVersionError);
  });

  it('parámetros de Argon2id desorbitados se rechazan antes de derivar la clave', async () => {
    const bytes = await encodeExport(samplePayload(), PASSWORD, OPTS);
    const { aad } = readHeader(bytes);
    const header = JSON.parse(Buffer.from(aad.subarray(8)).toString('utf8'));
    header.kdf.memLimitBytes = 64 * 1024 * 1024 * 1024;
    const json = new TextEncoder().encode(JSON.stringify(header));
    const evil = new Uint8Array(8 + json.length + 32);
    evil.set(bytes.subarray(0, 4), 0);
    new DataView(evil.buffer).setUint32(4, json.length, true);
    evil.set(json, 8);
    await expect(decodeExport(evil, PASSWORD)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('un contenido descifrado que no cumple el esquema da PayloadValidationError', async () => {
    const bad = samplePayload();
    (bad.collections.tasks[0] as { priority: number }).priority = 9;
    const bytes = await encodeExport(bad, PASSWORD, OPTS);
    const err = await decodeExport(bytes, PASSWORD).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayloadValidationError);
    expect((err as PayloadValidationError).issues.join()).toContain('collections.tasks.0.priority');
  });

  it('las colecciones que faltan se tratan como vacías', async () => {
    const partial = samplePayload() as unknown as { collections: Record<string, unknown> };
    delete partial.collections.animals;
    const bytes = await encodeExport(partial as unknown as ExportPayload, PASSWORD, OPTS);
    expect((await decodeExport(bytes, PASSWORD)).payload.collections.animals).toEqual([]);
  });
});

describe('migraciones del formato', () => {
  it('convierte un archivo antiguo a la versión actual', async () => {
    // Simulamos que la app ya va por el formato 2 y el archivo es del 1.
    const v1 = await encodeExport(samplePayload(), PASSWORD, { ...OPTS, formatVersion: 1 });
    const migrations = {
      1: (p: Record<string, unknown>) => ({ ...p, privateVault: { migrado: true } }),
    };
    const { payload } = await decodeExport(v1, PASSWORD, { currentVersion: 2, migrations });
    expect(payload.formatVersion).toBe(2);
    expect(payload.privateVault).toEqual({ migrado: true });
  });

  it('si falta una migración, lo dice en vez de importar datos a medias', async () => {
    const v1 = await encodeExport(samplePayload(), PASSWORD, OPTS);
    await expect(
      decodeExport(v1, PASSWORD, { currentVersion: 2, migrations: {} }),
    ).rejects.toBeInstanceOf(PayloadValidationError);
  });
});

describe('parámetros de producción', () => {
  it('exportar usa Argon2id fuerte por defecto (64 MiB, 3 pasadas)', async () => {
    expect(PRODUCTION_KDF).toEqual({ opsLimit: 3, memLimitBytes: 64 * 1024 * 1024 });
    const { db } = await openTestDb();
    const bytes = await exportDatabase(db, PASSWORD);
    expect(readHeader(bytes).header.kdf).toMatchObject({ opsLimit: 3, memLimitBytes: 67108864 });
  });

  it('la misma contraseña y salt derivan la misma clave; otro salt, otra', async () => {
    const salt = new Uint8Array(SALT_BYTES).fill(7);
    const other = new Uint8Array(SALT_BYTES).fill(8);
    const k1 = await deriveKey(PASSWORD, salt, TEST_KDF);
    const k2 = await deriveKey(PASSWORD, salt, TEST_KDF);
    const k3 = await deriveKey(PASSWORD, other, TEST_KDF);
    expect(k1).toEqual(k2);
    expect(k1).not.toEqual(k3);
  });
});
