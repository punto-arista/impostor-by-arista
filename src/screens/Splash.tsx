import { Layout } from '../components/Layout';

interface Props {
  label?: string;
  message: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}

/** Pantalla de espera o de error (sesión, catálogo). */
export function Splash({ label = 'cargando', message, detail, action }: Props) {
  return (
    <Layout label={label}>
      <div className="screen">
        <div className="body">
          <div className="display t34">
            {message}
            <span className="accent">.</span>
          </div>
          {detail && <div className="note">{detail}</div>}
        </div>
        {action && (
          <div className="foot">
            <button className="btn" onClick={action.onClick}>
              {action.label}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
