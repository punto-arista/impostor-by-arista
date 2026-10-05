import { describe, expect, it } from 'vitest';
import { MIN_PIN, generatePin, normalizeUsername, validateNewUser } from './validate';

describe('validateNewUser', () => {
  it('acepta datos válidos (normalizando mayúsculas y espacios)', () => {
    expect(validateNewUser('maria_01', '123456')).toBeNull();
    expect(validateNewUser('  Maria ', 'abcdef')).toBeNull();
  });

  it.each(['ab', 'a'.repeat(21), 'ma ria', 'maría', 'a@b', ''])('rechaza el usuario "%s"', (u) => {
    expect(validateNewUser(u, '123456')).not.toBeNull();
  });

  it('rechaza pines fuera de rango', () => {
    expect(validateNewUser('maria', '12345')).not.toBeNull();
    expect(validateNewUser('maria', 'x'.repeat(73))).not.toBeNull();
  });

  it('normalizeUsername recorta y pasa a minúsculas', () => {
    expect(normalizeUsername('  Ana_B ')).toBe('ana_b');
  });
});

describe('generatePin', () => {
  it('genera solo dígitos con la longitud pedida y cumple el mínimo', () => {
    for (let i = 0; i < 200; i++) {
      const pin = generatePin();
      expect(pin).toMatch(new RegExp(`^\\d{${MIN_PIN}}$`));
      expect(validateNewUser('maria', pin)).toBeNull();
    }
    expect(generatePin(8)).toHaveLength(8);
  });
});
