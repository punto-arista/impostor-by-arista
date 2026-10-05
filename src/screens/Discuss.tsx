interface Props {
  starter: string;
  onReveal: () => void;
  onRedeal: () => void;
}

const STEPS = [
  { n: '01', h: 'una palabra por turno.', t: 'di una palabra relacionada, ni muy obvia ni muy rara. no puedes decir la palabra secreta.' },
  { n: '02', h: 'sospechen en voz alta.', t: 'pregunten, debatan, desconfíen. el impostor también intenta señalar a otro.' },
  { n: '03', h: 'voten a la cuenta de tres.', t: 'todos señalan a la vez a quien crean que es el impostor. el más votado queda expuesto.' },
  { n: '04', h: 'toca revelar.', t: 've quién era el impostor y cuál era la palabra.' },
];

export function Discuss({ starter, onReveal, onRedeal }: Props) {
  return (
    <div className="screen">
      <div className="head">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          todos tienen su rol
        </div>
        <div className="display t34">
          empieza la
          <br />
          discusión.
        </div>
        <div className="rule" />
        <div className="copy muted">
          empieza <b className="accent">{starter}</b> y siguen en orden.
        </div>
      </div>
      <div className="steps loose">
        {STEPS.map((s) => (
          <div className="step-row" key={s.n}>
            <span className="step-num" style={{ fontSize: 13, paddingTop: 2 }}>
              {s.n}
            </span>
            <div>
              <div className="step-title">{s.h}</div>
              <div className="step-text">{s.t}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="foot">
        <button className="btn" onClick={onReveal}>
          ya votamos. revelar.
        </button>
        <button className="btn secondary" onClick={onRedeal}>
          repartir de nuevo.
        </button>
      </div>
    </div>
  );
}
