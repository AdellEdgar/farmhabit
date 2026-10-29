import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { RemoteFile, RemoteStore } from '@farmhabit/core';
import { deleteSecret, getSecret, SECRET_KEYS, setSecret } from './secrets';

// Google Drive como almacenamiento de la sincronización. Se usa la carpeta
// oculta de la app (appDataFolder): solo FarmHabit la ve, no aparece en tu
// Drive y no da acceso al resto de tus archivos. Todo lo que se sube va cifrado.
//
// Inicio de sesión: OAuth 2.0 para apps instaladas con PKCE y redirección a
// 127.0.0.1 (ver src-tauri/src/oauth.rs). Las credenciales de la app se
// configuran en apps/app/.env (ver docs/google-drive.md).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const isDriveConfigured = Boolean(CLIENT_ID);

export class NotSignedInError extends Error {
  constructor() {
    super('No has iniciado sesión en Google Drive');
    this.name = 'NotSignedInError';
  }
}

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

let accessToken: { value: string; expiresAt: number } | null = null;

function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function tokenRequest(params: Record<string, string>) {
  const body = new URLSearchParams({ client_id: CLIENT_ID!, ...params });
  if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant') throw new NotSignedInError();
    throw new DriveError(`Google rechazó el inicio de sesión (${json.error ?? res.status})`);
  }
  accessToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json;
}

/** Abre el navegador para iniciar sesión y guarda el permiso en el llavero. */
export async function signIn(): Promise<void> {
  if (!CLIENT_ID)
    throw new DriveError('Falta configurar las credenciales de Google (docs/google-drive.md)');
  const verifier = randomString(48);
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const state = randomString(16);
  const port = await invoke<number>('oauth_listen');
  const redirectUri = `http://127.0.0.1:${port}`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  const waiting = invoke<string>('oauth_wait');
  await openUrl(url.toString());
  const query = new URLSearchParams(await waiting);
  if (query.get('state') !== state) throw new DriveError('Respuesta de Google no válida');
  const code = query.get('code');
  if (!code)
    throw new DriveError(
      query.get('error') === 'access_denied'
        ? 'Has cancelado el inicio de sesión'
        : 'Google no devolvió el código',
    );

  const tokens = await tokenRequest({
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  if (!tokens.refresh_token)
    throw new DriveError('Google no concedió acceso permanente. Vuelve a intentarlo.');
  await setSecret(SECRET_KEYS.googleRefreshToken, tokens.refresh_token);
}

export async function isSignedIn(): Promise<boolean> {
  return (await getSecret(SECRET_KEYS.googleRefreshToken)) !== null;
}

export async function signOut(): Promise<void> {
  const refresh = await getSecret(SECRET_KEYS.googleRefreshToken);
  accessToken = null;
  await deleteSecret(SECRET_KEYS.googleRefreshToken);
  if (refresh) {
    // Retirar el permiso en Google (si falla no pasa nada: ya no lo guardamos).
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
      method: 'POST',
    }).catch(() => undefined);
  }
}

async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt - 60_000 > Date.now()) return accessToken.value;
  const refresh = await getSecret(SECRET_KEYS.googleRefreshToken);
  if (!refresh) throw new NotSignedInError();
  try {
    await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
  } catch (e) {
    if (e instanceof NotSignedInError) await deleteSecret(SECRET_KEYS.googleRefreshToken);
    throw e;
  }
  return accessToken!.value;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    accessToken = null;
    throw new NotSignedInError();
  }
  if (!res.ok) throw new DriveError(`Error de Google Drive (${res.status})`);
  return res;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

/** Carpeta oculta de FarmHabit en Google Drive. */
export class DriveStore implements RemoteStore {
  private ids = new Map<string, string>();

  async list(): Promise<RemoteFile[]> {
    const url = `${DRIVE}/files?spaces=appDataFolder&pageSize=1000&fields=${encodeURIComponent('files(id,name,modifiedTime)')}`;
    const { files } = (await (await driveFetch(url)).json()) as { files: DriveFile[] };
    // Si hubiera dos archivos con el mismo nombre, se usa el más reciente.
    const latest = new Map<string, DriveFile>();
    for (const f of files) {
      const prev = latest.get(f.name);
      if (!prev || f.modifiedTime > prev.modifiedTime) latest.set(f.name, f);
    }
    this.ids = new Map([...latest.values()].map((f) => [f.name, f.id]));
    return [...latest.values()].map((f) => ({
      name: f.name,
      modifiedAt: Date.parse(f.modifiedTime),
    }));
  }

  async read(name: string): Promise<Uint8Array | null> {
    if (!this.ids.has(name)) await this.list();
    const id = this.ids.get(name);
    if (!id) return null;
    const res = await driveFetch(`${DRIVE}/files/${id}?alt=media`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async write(name: string, data: Uint8Array): Promise<void> {
    if (!this.ids.has(name)) await this.list();
    const id = this.ids.get(name);
    if (id) {
      await driveFetch(`${UPLOAD}/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(data),
      });
      return;
    }
    const boundary = `farmhabit-${randomString(8)}`;
    const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + data.length + tail.length);
    body.set(head, 0);
    body.set(data, head.length);
    body.set(tail, head.length + data.length);
    const res = await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const { id: newId } = (await res.json()) as { id: string };
    this.ids.set(name, newId);
  }
}
