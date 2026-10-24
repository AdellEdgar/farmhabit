/** Une clases CSS ignorando las vacías o condicionales falsas. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
