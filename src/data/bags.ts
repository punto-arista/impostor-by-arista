import type { Bags } from '../game/types';
import { load, save } from './storage';

const KEY = 'bags';

export async function loadBags(): Promise<Bags> {
  return (await load<Bags>(KEY)) ?? {};
}

export function saveBags(bags: Bags): Promise<void> {
  return save(KEY, bags);
}
