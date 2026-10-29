// Hashes rápidos y deterministas (NO criptográficos): sirven para elegir
// "al azar" siempre lo mismo en todos los dispositivos.

/**
 * FNV-1a de 32 bits. Lo usa el motor de la granja para elegir víctima, padre
 * y nombre: NO cambiarlo, o al recalcular cambiarían las muertes pasadas.
 */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Número estable en [0, 1) a partir de un texto. Añade la mezcla final de
 * MurmurHash3 (fmix32): sin ella, textos casi iguales dan números parecidos.
 */
export function stableRandom(text: string): number {
  let h = fnv1a(text);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}
