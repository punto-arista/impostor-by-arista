import { useState, type FormEvent } from 'react';
import { signIn } from '../auth/session';
import { Layout } from '../components/Layout';

export function Login() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = username.trim() !== '' && pin !== '' && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    // Si el acceso es correcto, onAuthStateChange cambia la sesión y App cambia de pantalla.
    const msg = await signIn(username, pin);
    if (msg) {
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <Layout label="acceso">
      <form className="screen" onSubmit={submit}>
        <div className="body">
          <img className="login-logo" src="/brand/impostor-logo.png" alt="impostor." width="96" height="96" />
          <div className="display t56">
            impostor<span className="accent">.</span>
          </div>
          <div className="rule" />
          <div className="display t20 accent">todos saben la palabra. menos uno.</div>

          <label className="eyebrow" htmlFor="user" style={{ marginTop: 20 }}>
            tu usuario
          </label>
          <input
            id="user"
            className="field big"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            placeholder="ej. argenis"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <label className="eyebrow" htmlFor="pin">
            tu pin
          </label>
          <input
            id="pin"
            className="field big"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />

          {error ? (
            <div className="error" role="alert">
              {error}
            </div>
          ) : (
            <div className="note" style={{ marginTop: 0 }}>
              el acceso es solo por invitación. si no tienes usuario, pídeselo a arista.
            </div>
          )}
        </div>
        <div className="foot">
          <button className="btn" type="submit" disabled={!ready}>
            {busy ? 'entrando…' : 'entrar.'}
          </button>
        </div>
      </form>
    </Layout>
  );
}
