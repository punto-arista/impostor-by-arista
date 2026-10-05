import type { Round } from '../game/types';

interface Props {
  round: Round;
  onAgain: () => void;
  onSetup: () => void;
}

export function Final({ round, onAgain, onSetup }: Props) {
  const impostorCount = round.roles.filter((r) => r.isImpostor).length;
  // Impostores primero; el resto conserva el orden de la mesa.
  const list = [...round.roles].sort((a, b) => Number(b.isImpostor) - Number(a.isImpostor));

  return (
    <div className="screen">
      <div className="head">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          la palabra secreta era
        </div>
        <div className="display t48 accent" style={{ wordBreak: 'break-word' }}>
          {round.word}
          <span style={{ color: 'var(--foreground)' }}>.</span>
        </div>
        <div className="copy muted" style={{ fontSize: 14, marginTop: 12 }}>
          categoría: {round.categoryName}
        </div>
      </div>
      <div style={{ padding: 20, flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {impostorCount > 1 ? 'los impostores eran' : 'el impostor era'}
        </div>
        {list.map((r, i) => (
          <div className="row" key={i}>
            <span className="row-name">{r.name}</span>
            <span className={`tag${r.isImpostor ? ' imp' : ''}`}>{r.isImpostor ? 'impostor' : 'sabía la palabra'}</span>
          </div>
        ))}
        <div className="note" style={{ marginTop: 16 }}>
          si votaron al impostor: ganan los que sabían la palabra. si no: gana el impostor.
        </div>
      </div>
      <div className="foot">
        <button className="btn" onClick={onAgain}>
          otra ronda.
        </button>
        <button className="btn secondary" onClick={onSetup}>
          cambiar ajustes.
        </button>
      </div>
    </div>
  );
}
