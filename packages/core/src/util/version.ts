// Comparación de versiones semánticas (https://semver.org/lang/es/), para
// saber si hay una versión de FarmHabit más reciente que la instalada.

interface Parsed {
  core: [number, number, number];
  pre: string[];
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parse(version: string): Parsed | null {
  const m = SEMVER.exec(version.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.') : [],
  };
}

export function isSemver(version: string): boolean {
  return parse(version) !== null;
}

/** Identificadores de prerelease: los numéricos se comparan como números y van antes que los de texto. */
function comparePre(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Math.sign(Number(a) - Number(b));
  if (na !== nb) return na ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Negativo si `a` es anterior a `b`, positivo si es posterior y 0 si son la
 * misma versión. Una prerelease va antes que su versión final
 * (1.0.0-rc.2 < 1.0.0). Lanza un error si alguna no es una versión válida.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) throw new Error(`Versión no válida: ${pa ? b : a}`);
  for (let i = 0; i < 3; i++) {
    const d = pa.core[i]! - pb.core[i]!;
    if (d !== 0) return Math.sign(d);
  }
  // Sin prerelease es la versión final: va después de cualquier prerelease.
  if (pa.pre.length === 0 || pb.pre.length === 0) return Math.sign(pb.pre.length - pa.pre.length);
  for (let i = 0; i < Math.min(pa.pre.length, pb.pre.length); i++) {
    const d = comparePre(pa.pre[i]!, pb.pre[i]!);
    if (d !== 0) return d;
  }
  return Math.sign(pa.pre.length - pb.pre.length);
}
