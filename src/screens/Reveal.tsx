import type { Round } from '../game/types';

interface Props {
  round: Round;
  idx: number;
  onHideNext: () => void;
}

/** Paso 2 de cada turno: el rol, visible solo hasta que se oculta. */
export function Reveal({ round, idx, onHideNext }: Props) {
  const role = round.roles[idx];
  const isLast = idx === round.roles.length - 1;

  const instruction = role.isImpostor
    ? role.hint
      ? 'no conoces la palabra. escucha a los demás, usa tu pista y finge que la sabes.'
      : 'no conoces la palabra y no tienes pista. escucha con atención y finge que la sabes.'
    : 'describe la palabra sin decirla. que el impostor no la adivine, pero que los demás sí te entiendan.';

  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="tu rol">
        <div className="dialog-head">{role.name} · solo tú puedes ver esto</div>
        <div className="dialog-body">
          <div className="display muted" style={{ fontSize: 18 }}>
            {role.isImpostor ? 'tu rol es' : 'tu palabra secreta es'}
          </div>
          <div className={`display role-word${role.isImpostor ? ' imp' : ''}`} style={{ fontSize: role.isImpostor ? 56 : 48, lineHeight: 1 }}>
            {role.isImpostor ? 'impostor.' : round.word}
          </div>
          <div className="rule" style={{ margin: 0 }} />
          <div className="copy">{instruction}</div>
          {role.hint && (
            <div className="hint-box">
              <div className="eyebrow">tu pista</div>
              <div className="display" style={{ fontSize: 24 }}>
                {role.hint}
              </div>
              <div className="note">está relacionada con la palabra. úsala para disimular.</div>
            </div>
          )}
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onHideNext} autoFocus>
            {isLast ? 'ocultar. empezar a jugar.' : 'ocultar y pasar al siguiente.'}
          </button>
          <p>al tocar, tu rol se oculta. no lo vuelves a ver.</p>
        </div>
      </div>
    </div>
  );
}
