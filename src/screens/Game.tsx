import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Layout } from '../components/Layout';
import { loadBags, saveBags } from '../data/bags';
import { recordRound } from '../data/rounds';
import { loadSettings, saveSettings } from '../data/settingsStore';
import { drawRound } from '../game/draw';
import { initialState, reducer, type Screen } from '../game/reducer';
import { MIX, type Bags, type Catalog } from '../game/types';
import { useWakeLock } from '../pwa/wakeLock';
import { Discuss } from './Discuss';
import { Final } from './Final';
import { Handoff } from './Handoff';
import { Reveal } from './Reveal';
import { Setup } from './Setup';

const LABELS: Record<Screen, string> = {
  setup: 'ajustes',
  handoff: 'repartiendo',
  reveal: 'repartiendo',
  discuss: 'discusión',
  final: 'resultado',
};

interface Props {
  catalog: Catalog;
  user: string | null;
  onLogout?: () => void;
  /** Solo para administradores: abre la vista de alta de usuarios. */
  onAdmin?: () => void;
}

export function Game({ catalog, user, onLogout, onAdmin }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadSettings()));
  const { screen, settings, round, idx } = state;

  const bagsRef = useRef<Bags | null>(null);
  const startingRef = useRef(false);

  useEffect(() => saveSettings(settings), [settings]);
  // Con el teléfono pasando de mano en mano, la pantalla no debe apagarse.
  useWakeLock(screen === 'handoff' || screen === 'reveal' || screen === 'discuss');

  const categories = useMemo(
    () => [...catalog.categories.map((c) => ({ slug: c.slug, label: c.name })), { slug: MIX, label: 'mezcla de todo' }],
    [catalog],
  );
  // La categoría guardada pudo desaparecer del catálogo: se cae a la primera.
  const category = categories.some((c) => c.slug === settings.category) ? settings.category : categories[0].slug;

  async function start() {
    if (startingRef.current) return; // evita doble toque
    startingRef.current = true;
    try {
      const bags = bagsRef.current ?? (await loadBags());
      const { round: next, bags: nextBags } = drawRound(catalog, { ...settings, category }, bags);
      bagsRef.current = nextBags;
      void saveBags(nextBags);
      void recordRound(next);
      dispatch({ type: 'START', round: next });
    } finally {
      startingRef.current = false;
    }
  }

  return (
    <Layout
      label={LABELS[screen]}
      user={user}
      onLogout={onLogout}
      // Solo en ajustes: durante una ronda un toque accidental perdería la partida en curso.
      onAdmin={screen === 'setup' ? onAdmin : undefined}
      allowUpdate={screen === 'setup' || screen === 'final'}
    >
      {screen === 'setup' && (
        <Setup settings={{ ...settings, category }} categories={categories} dispatch={dispatch} onStart={start} />
      )}
      {(screen === 'handoff' || screen === 'reveal') && round && (
        <Handoff round={round} idx={idx} onShowRole={() => dispatch({ type: 'SHOW_ROLE' })} />
      )}
      {screen === 'reveal' && round && <Reveal round={round} idx={idx} onHideNext={() => dispatch({ type: 'NEXT' })} />}
      {screen === 'discuss' && round && (
        <Discuss starter={round.starter} onReveal={() => dispatch({ type: 'REVEAL_ALL' })} onRedeal={start} />
      )}
      {screen === 'final' && round && (
        <Final round={round} onAgain={start} onSetup={() => dispatch({ type: 'TO_SETUP' })} />
      )}
    </Layout>
  );
}
