import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { bookSearchUrl, parseBookSearch, type BookCandidate } from '@farmhabit/core';
import { isDesktopApp } from './drivers';

/** Busca en Open Library. Lanza un error con un mensaje para el usuario si no se puede. */
export async function searchBooks(query: string): Promise<BookCandidate[]> {
  const doFetch = isDesktopApp ? tauriFetch : window.fetch.bind(window);
  let res: Response;
  try {
    res = await doFetch(bookSearchUrl(query));
  } catch {
    throw new Error('No se pudo buscar. ¿Hay conexión? También puedes añadirlo a mano.');
  }
  if (!res.ok) throw new Error(`Open Library respondió ${res.status}. Prueba a añadirlo a mano.`);
  try {
    return parseBookSearch(await res.json());
  } catch {
    throw new Error('Open Library devolvió una respuesta rara. Prueba a añadirlo a mano.');
  }
}
