import { describe, expect, it } from 'vitest';
import { APP_NAME, EXPORT_FORMAT_VERSION, SCHEMA_VERSION } from '../src/index';

describe('núcleo', () => {
  it('expone el nombre de la app y las versiones', () => {
    expect(APP_NAME).toBe('FarmHabit');
    expect(EXPORT_FORMAT_VERSION).toBe(1);
    expect(SCHEMA_VERSION).toBe(2);
  });
});
