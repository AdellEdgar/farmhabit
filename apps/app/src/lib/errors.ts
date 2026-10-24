/** Mensaje legible para el usuario a partir de cualquier error. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    // Los errores de validación de zod son técnicos: resumirlos.
    if (e.name === 'ZodError') return 'Hay datos que no son válidos. Revisa el formulario.';
    return e.message;
  }
  if (typeof e === 'string') return e;
  return 'Ha ocurrido un error inesperado';
}
