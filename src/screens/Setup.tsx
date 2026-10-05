import { useState, type Dispatch } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, clampPlayers, maxImpostors } from '../game/limits';
import type { Action } from '../game/reducer';
import type { Settings } from '../game/types';

export interface CategoryOption {
  slug: string;
  label: string;
}

interface Props {
  settings: Settings;
  categories: CategoryOption[];
  dispatch: Dispatch<Action>;
  onStart: () => void;
}

const HOW_STEPS = [
  { n: '01', t: 'el dispositivo pasa de mano en mano. cada quien ve su rol en secreto.' },
  { n: '02', t: 'todos reciben la misma palabra, excepto el impostor, que no la conoce.' },
  { n: '03', t: 'por turnos, cada quien dice una palabra relacionada. sin ser obvio.' },
  { n: '04', t: 'voten quién es el impostor. si lo descubren, ganan. si no, gana él.' },
];

export function Setup({ settings, categories, dispatch, onStart }: Props) {
  const { players, impostors, names, category, withHints } = settings;
  const [helpOpen, setHelpOpen] = useState(false);
  // Texto del campo de jugadores: permite borrar y reescribir sin saltos.
  const [pText, setPText] = useState(String(players));

  const setPlayers = (n: number) => {
    const p = clampPlayers(n);
    setPText(String(p));
    dispatch({ type: 'SET_PLAYERS', players: p });
  };
  const maxImp = maxImpostors(players);

  return (
    <div className="screen">
      <div className="head" style={{ padding: '28px 20px 24px' }}>
        <div className="display t40">
          encuentra al
          <br />
          impostor.
        </div>
        <div className="rule" />
        <div className="display t20 accent">todos saben la palabra. menos uno.</div>
        <button className="text-btn" onClick={() => setHelpOpen(!helpOpen)} aria-expanded={helpOpen}>
          ¿cómo se juega? {helpOpen ? '↑' : '↓'}
        </button>
        {helpOpen && (
          <div className="steps">
            {HOW_STEPS.map((s) => (
              <div className="step-row" key={s.n}>
                <span className="step-num">{s.n}</span>
                <span>{s.t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="section">
        <div className="label">1 · jugadores</div>
        <div className="stepper">
          <button onClick={() => setPlayers(players - 1)} disabled={players <= MIN_PLAYERS} aria-label="menos jugadores">
            −
          </button>
          <input
            className="value"
            type="number"
            inputMode="numeric"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={pText}
            aria-label="número de jugadores"
            onChange={(e) => {
              setPText(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (n >= MIN_PLAYERS && n <= MAX_PLAYERS) dispatch({ type: 'SET_PLAYERS', players: n });
            }}
            onBlur={() => setPText(String(players))}
          />
          <button onClick={() => setPlayers(players + 1)} disabled={players >= MAX_PLAYERS} aria-label="más jugadores">
            +
          </button>
        </div>
        <div className="note">
          escribe o usa los botones. de {MIN_PLAYERS} a {MAX_PLAYERS} personas.
        </div>
      </section>

      <section className="section">
        <div className="label">2 · nombres (opcional)</div>
        <div className="names">
          {Array.from({ length: players }, (_, i) => (
            <div className="name-row" key={i}>
              <span className="name-num">{String(i + 1).padStart(2, '0')}</span>
              <input
                className="field"
                value={names[i] ?? ''}
                onChange={(e) => dispatch({ type: 'SET_NAME', index: i, name: e.target.value })}
                maxLength={16}
                placeholder={`jugador ${i + 1}`}
                aria-label={`nombre del jugador ${i + 1}`}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <div className="note">si lo dejas vacío, se llamará "jugador 1", "jugador 2"…</div>
      </section>

      <section className="section">
        <div className="label">3 · impostores</div>
        <div className="stepper">
          <button
            onClick={() => dispatch({ type: 'SET_IMPOSTORS', impostors: impostors - 1 })}
            disabled={impostors <= 1}
            aria-label="menos impostores"
          >
            −
          </button>
          <div className="value">{impostors}</div>
          <button
            onClick={() => dispatch({ type: 'SET_IMPOSTORS', impostors: impostors + 1 })}
            disabled={impostors >= maxImp}
            aria-label="más impostores"
          >
            +
          </button>
        </div>
        <div className="note">
          {impostors} {impostors > 1 ? 'impostores engañan' : 'impostor engaña'} a {players - impostors} que sí saben la
          palabra.
        </div>
      </section>

      <section className="section">
        <div className="label">4 · categoría de la palabra</div>
        <div className="chips">
          {categories.map((c) => (
            <button
              key={c.slug}
              className="chip"
              aria-pressed={c.slug === category}
              onClick={() => dispatch({ type: 'SET_CATEGORY', category: c.slug })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="label">5 · dificultad del impostor</div>
        <div className="choices">
          <button className="choice" aria-pressed={withHints} onClick={() => dispatch({ type: 'SET_HINTS', withHints: true })}>
            <b>con pista.</b>
            <span>cada impostor recibe una pista distinta para disimular</span>
          </button>
          <button className="choice" aria-pressed={!withHints} onClick={() => dispatch({ type: 'SET_HINTS', withHints: false })}>
            <b>a ciegas.</b>
            <span>no recibe nada. modo difícil</span>
          </button>
        </div>
      </section>

      <div style={{ flex: 1 }} />
      <div className="foot sticky">
        <button className="btn" onClick={onStart}>
          repartir roles.
        </button>
      </div>
    </div>
  );
}
