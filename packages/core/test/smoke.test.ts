import { describe, expect, it } from 'vitest';
import { APP_NAME, EXPORT_FORMAT_VERSION } from '../src/index';

describe('núcleo', () => {
  it('expone el nombre de la app', () => {
    expect(APP_NAME).toBe('FarmHabit');
  });

  it('empieza en la versión 1 del formato de exportación', () => {
    expect(EXPORT_FORMAT_VERSION).toBe(1);
  });
});
