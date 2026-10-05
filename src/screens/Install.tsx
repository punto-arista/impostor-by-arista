import { Layout } from '../components/Layout';
import { useInstall } from '../pwa/install';

const IOS_STEPS = [
  { n: '01', t: 'toca el botón compartir (el cuadro con la flecha hacia arriba) en la barra de Safari.' },
  { n: '02', t: 'elige "agregar a inicio" y confirma.' },
  { n: '03', t: 'abre impostor. desde tu pantalla de inicio e inicia sesión ahí.' },
];

export function Install({ onSkip }: { onSkip: () => void }) {
  const { ios, canInstall, install, canFullscreen, toggleFullscreen } = useInstall();

  return (
    <Layout label="instalar">
      <div className="screen">
        <div className="body">
          <div className="eyebrow">mejor como app</div>
          <div className="display t40">
            instala
            <br />
            impostor<span className="accent">.</span>
          </div>
          <div className="rule" />
          <div className="display t20 accent">pantalla completa. sin barras.</div>

          {ios && (
            <>
              <div className="steps">
                {IOS_STEPS.map((s) => (
                  <div className="step-row" key={s.n}>
                    <span className="step-num">{s.n}</span>
                    <span>{s.t}</span>
                  </div>
                ))}
              </div>
              <div className="note">
                en iPhone la app instalada guarda su propia sesión: aunque ya hayas entrado en Safari, tendrás que iniciar
                sesión dentro de la app.
              </div>
            </>
          )}

          {!ios && !canInstall && (
            <div className="copy muted">
              abre el menú del navegador y elige "instalar app" o "agregar a pantalla de inicio".
            </div>
          )}
        </div>

        <div className="foot">
          {!ios && canInstall && (
            <button className="btn" onClick={install}>
              instalar.
            </button>
          )}
          {!ios && canFullscreen && (
            <button className="btn secondary" onClick={toggleFullscreen}>
              pantalla completa.
            </button>
          )}
          <button className="btn secondary" onClick={onSkip}>
            continuar en el navegador.
          </button>
        </div>
      </div>
    </Layout>
  );
}
