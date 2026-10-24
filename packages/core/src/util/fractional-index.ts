// Índices fraccionales para el orden manual: insertar o mover un elemento
// solo cambia SU clave, así que dos dispositivos que reordenan cosas distintas
// no se pisan al fusionar. Algoritmo basado en el de Rocicorp/Figma
// (solo la parte fraccional). Las claves nunca acaban en '0'.

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]!) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (digitB - digitA > 1) {
    return DIGITS[Math.round((digitA + digitB) / 2)]!;
  }
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

function validate(key: string): void {
  if (key === '' || key.endsWith('0') || [...key].some((c) => !DIGITS.includes(c))) {
    throw new Error(`Clave de orden no válida: ${key}`);
  }
}

/** Clave estrictamente entre `a` y `b` (null = sin límite por ese lado). */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) validate(a);
  if (b !== null) validate(b);
  if (a !== null && b !== null && a >= b) {
    throw new Error(`keyBetween: ${a} >= ${b}`);
  }
  return midpoint(a ?? '', b);
}

/** Orden estable: por clave y, a igualdad (inserciones simultáneas), por id. */
export function compareSortKey(
  x: { sortKey: string; id: string },
  y: { sortKey: string; id: string },
): number {
  if (x.sortKey !== y.sortKey) return x.sortKey < y.sortKey ? -1 : 1;
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}
