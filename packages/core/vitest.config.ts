import { defineConfig } from 'vitest/config';

// Zona horaria fija para que los tests de fechas y avisos sean reproducibles
// (incluye cambios de hora: Madrid pasa a verano el último domingo de marzo).
process.env.TZ = 'Europe/Madrid';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
