import { MAX_PLAYERS, clampImpostors, clampPlayers } from './limits';
import type { Round, Settings } from './types';

export type Screen = 'setup' | 'handoff' | 'reveal' | 'discuss' | 'final';

export interface GameState {
  screen: Screen;
  settings: Settings;
  round: Round | null;
  /** Jugador al que le toca ver su rol. */
  idx: number;
}

export type Action =
  | { type: 'SET_PLAYERS'; players: number }
  | { type: 'SET_NAME'; index: number; name: string }
  | { type: 'SET_IMPOSTORS'; impostors: number }
  | { type: 'SET_CATEGORY'; category: string }
  | { type: 'SET_HINTS'; withHints: boolean }
  | { type: 'START'; round: Round }
  | { type: 'SHOW_ROLE' }
  | { type: 'NEXT' }
  | { type: 'REVEAL_ALL' }
  | { type: 'TO_SETUP' };

export const DEFAULT_SETTINGS: Settings = {
  players: 5,
  names: Array(MAX_PLAYERS).fill(''),
  impostors: 1,
  category: 'comida',
  withHints: true,
};

export function initialState(settings: Settings = DEFAULT_SETTINGS): GameState {
  return { screen: 'setup', settings, round: null, idx: 0 };
}

export function reducer(state: GameState, action: Action): GameState {
  const s = state.settings;
  switch (action.type) {
    case 'SET_PLAYERS': {
      const players = clampPlayers(action.players);
      return { ...state, settings: { ...s, players, impostors: clampImpostors(s.impostors, players) } };
    }
    case 'SET_NAME': {
      if (action.index < 0 || action.index >= MAX_PLAYERS) return state;
      const names = [...s.names];
      names[action.index] = action.name;
      return { ...state, settings: { ...s, names } };
    }
    case 'SET_IMPOSTORS':
      return { ...state, settings: { ...s, impostors: clampImpostors(action.impostors, s.players) } };
    case 'SET_CATEGORY':
      return { ...state, settings: { ...s, category: action.category } };
    case 'SET_HINTS':
      return { ...state, settings: { ...s, withHints: action.withHints } };
    case 'START':
      return { ...state, screen: 'handoff', round: action.round, idx: 0 };
    case 'SHOW_ROLE':
      return state.screen === 'handoff' ? { ...state, screen: 'reveal' } : state;
    case 'NEXT': {
      if (state.screen !== 'reveal' || !state.round) return state;
      const last = state.idx >= state.round.roles.length - 1;
      return last ? { ...state, screen: 'discuss' } : { ...state, screen: 'handoff', idx: state.idx + 1 };
    }
    case 'REVEAL_ALL':
      return state.screen === 'discuss' ? { ...state, screen: 'final' } : state;
    case 'TO_SETUP':
      return { ...state, screen: 'setup', round: null, idx: 0 };
  }
}
