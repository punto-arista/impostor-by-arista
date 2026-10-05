import type { Round } from '../game/types';

interface Props {
  round: Round;
  idx: number;
  onShowRole: () => void;
}

/** Paso 1 de cada turno: el dispositivo cambia de mano. Aún no se muestra ningún rol. */
export function Handoff({ round, idx, onShowRole }: Props) {
  const name = round.roles[idx].name;
  return (
    <div className="screen" style={{ animationDuration: '.5s' }}>
      <div className="dots" aria-hidden="true">
        {round.roles.map((_, i) => (
          <div key={i} className={`dot${i < idx ? ' done' : i === idx ? ' now' : ''}`} />
        ))}
      </div>
      <div className="body">
        <div className="eyebrow">
          turno {idx + 1} de {round.roles.length} · paso 1 de 2
        </div>
        <div className="display t22 muted">pasa el dispositivo a</div>
        <div className="display t56" style={{ wordBreak: 'break-word' }}>
          {name}
          <span className="accent">.</span>
        </div>
        <div className="rule" style={{ margin: 0 }} />
        <div className="copy muted">
          los demás miran hacia otro lado. cuando tengas el dispositivo, toca el botón para ver tu rol en secreto.
        </div>
      </div>
      <div className="foot">
        <button className="btn" onClick={onShowRole}>
          soy {name}. ver mi rol.
        </button>
      </div>
    </div>
  );
}
