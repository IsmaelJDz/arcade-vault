"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useSession } from "../session-provider";

const CONFIRM_ERROR =
  "No pudimos confirmar tu correo. El enlace pudo caducar; inicia sesión o regístrate de nuevo.";

function Auth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [sending, setSending] = useState(false);
  // Aviso inicial si el callback de confirmación falló (link caducado/inválido).
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "confirmacion" ? CONFIRM_ERROR : null,
  );
  const [sent, setSent] = useState(false); // registro OK → "revisa tu correo"

  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);

    if (tab === "in") {
      const res = await signIn(email, pass);
      if (res.ok) {
        router.push("/games");
        return;
      }
      setError(res.error);
      setSending(false);
    } else {
      const res = await signUp(email, pass, name || "PLAYER1");
      if (res.ok) {
        setSent(true);
        setSending(false);
        return;
      }
      setError(res.error);
      setSending(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {sent ? (
          <div className="slide-in" style={{ textAlign: "center", padding: "8px 0" }}>
            <h3 className="neon-cyan" style={{ marginBottom: 10 }}>
              REVISA TU CORREO
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-faint)",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar
              tu cuenta y entrar al Vault.
            </p>
            <button
              className="btn ghost"
              style={{ width: "100%" }}
              onClick={() => {
                setSent(false);
                setTab("in");
                setPass("");
              }}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={tab === "in" ? "on" : ""} onClick={() => switchTab("in")}>
                INICIAR SESIÓN
              </button>
              <button className={tab === "up" ? "on" : ""} onClick={() => switchTab("up")}>
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit}>
              {tab === "up" && (
                <div className="field slide-in">
                  <label>Usuario</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="px_kai"
                  />
                </div>
              )}
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--neon-magenta, #ff3ea5)",
                    lineHeight: 1.5,
                    margin: "4px 0 2px",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={sending}
                style={{ width: "100%", marginTop: 8, opacity: sending ? 0.6 : 1 }}
              >
                {sending ? "ENVIANDO…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
              </button>
            </form>

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => router.push("/games")}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button className="btn ghost" type="button">
                ◆ GOOGLE
              </button>
              <button className="btn ghost" type="button">
                ▣ GITHUB
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                textAlign: "center",
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <Auth />
    </Suspense>
  );
}
