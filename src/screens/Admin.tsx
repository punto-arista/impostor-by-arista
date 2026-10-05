import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createUser, listUsers, setUserActive, type ManagedUser } from '../auth/admin';
import { generatePin, normalizeUsername, validateNewUser } from '../auth/validate';
import { Layout } from '../components/Layout';

interface Created {
  username: string;
  pin: string;
}

function lastSeen(iso: string | null): string {
  if (!iso) return 'aún no ha entrado';
  return 'última vez ' + new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/** Alta y gestión de usuarios. Solo se muestra a admins; la base de datos lo vuelve a comprobar. */
export function Admin({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await listUsers();
    if (res.ok) {
      setUsers(res.users);
      setListError(null);
    } else {
      setListError(res.message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ready = username.trim() !== '' && pin !== '' && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const invalid = validateNewUser(username, pin);
    if (invalid) return setError(invalid);

    setBusy(true);
    setError(null);
    setCreated(null);
    const res = await createUser(normalizeUsername(username), pin);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    // El PIN se muestra una vez para poder compartirlo; en la base solo queda cifrado.
    setCreated({ username: res.username, pin });
    setCopied(false);
    setUsername('');
    setPin('');
    void refresh();
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`usuario: ${created.username}\npin: ${created.pin}`);
      setCopied(true);
    } catch {
      /* el portapapeles puede estar bloqueado: se puede copiar a mano */
    }
  }

  async function toggle(u: ManagedUser) {
    setTogglingId(u.id);
    setListError(null);
    const res = await setUserActive(u.id, !u.is_active);
    setTogglingId(null);
    if (!res.ok) return setListError(res.message);
    await refresh();
  }

  return (
    <Layout label="admin">
      <form className="screen" onSubmit={submit}>
        <div className="head">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            solo administrador
          </div>
          <div className="display t34">
            usuarios.
          </div>
          <div className="rule" />
          <div className="copy muted">crea cuentas para tus amigos y decide quién puede entrar. compárteles su usuario y su pin.</div>
        </div>

        {/* Arriba, para que se vea sin hacer scroll y no quede tapada por el pie fijo. */}
        {created && (
          <section className="section" aria-live="polite">
            <div className="hint-box">
              <div className="eyebrow">usuario creado y activo</div>
              <div className="display" style={{ fontSize: 24, marginTop: 6 }}>
                {created.username}
              </div>
              <div className="display accent" style={{ fontSize: 24, letterSpacing: '0.08em' }}>
                {created.pin}
              </div>
              <button type="button" className="btn secondary" style={{ marginTop: 14 }} onClick={copy}>
                {copied ? 'copiado.' : 'copiar usuario y pin.'}
              </button>
            </div>
          </section>
        )}

        <section className="section">
          <label className="label" htmlFor="new-user">
            nuevo usuario
          </label>
          <input
            id="new-user"
            className="field big"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            placeholder="ej. maria"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="note">de 3 a 20 caracteres: minúsculas, números o guion bajo.</div>
        </section>

        <section className="section">
          <label className="label" htmlFor="new-pin">
            pin
          </label>
          <input
            id="new-pin"
            className="field big"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={72}
            placeholder="mínimo 6 caracteres"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" className="text-btn" style={{ marginTop: 8 }} onClick={() => setPin(generatePin())}>
            generar pin al azar.
          </button>
        </section>

        {error && (
          <div className="section" style={{ borderBottom: 0 }}>
            <div className="error" role="alert">
              {error}
            </div>
          </div>
        )}

        <section className="section">
          <div className="label">usuarios registrados</div>
          {listError && (
            <div className="error" role="alert" style={{ marginBottom: 8 }}>
              {listError}
            </div>
          )}
          {users === null && !listError && <div className="note">cargando…</div>}
          {users?.map((u) => (
            <div className="row" key={u.id}>
              <div>
                <div className="row-name">{u.username}</div>
                <div className={`tag${!u.is_active ? ' imp' : ''}`}>
                  {u.is_admin ? 'admin' : u.is_active ? 'activo' : 'desactivado'} · {lastSeen(u.last_sign_in_at)}
                </div>
              </div>
              {!u.is_admin && (
                <button
                  type="button"
                  className={`mini-btn${u.is_active ? ' warn' : ''}`}
                  disabled={togglingId === u.id}
                  onClick={() => toggle(u)}
                >
                  {u.is_active ? 'desactivar' : 'activar'}
                </button>
              )}
            </div>
          ))}
          {users && users.length > 0 && (
            <div className="note">desactivar cierra sus sesiones y le impide volver a entrar hasta que lo actives.</div>
          )}
        </section>

        <div style={{ flex: 1 }} />
        <div className="foot sticky">
          <button className="btn" type="submit" disabled={!ready}>
            {busy ? 'creando…' : 'crear usuario.'}
          </button>
          <button className="btn secondary" type="button" onClick={onBack}>
            volver.
          </button>
        </div>
      </form>
    </Layout>
  );
}
