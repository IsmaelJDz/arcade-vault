"use client";

import { useEffect, useState } from "react";

// Mismo patrón reveal-on-scroll que Home (spec 02): el observer solo se monta
// dentro de useEffect para no causar mismatch de hidratación SSR.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// Mismo criterio de email que el servidor (regex básico).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "sending" | "success" | "error";

const HIGHLIGHTS = [
  { i: "HEART", t: "HECHO CON ❤️ PARA JUGADORES", c: "magenta" },
  { i: "BROWSER", t: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", c: "cyan" },
  { i: "PLANT", t: "PROYECTO EN CONSTANTE CRECIMIENTO", c: "green" },
] as const;

function HighlightIcon({ kind }: { kind: string }) {
  if (kind === "HEART")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16">
        <g fill="currentColor">
          <rect x="2" y="3" width="4" height="2" />
          <rect x="10" y="3" width="4" height="2" />
          <rect x="1" y="4" width="2" height="4" />
          <rect x="13" y="4" width="2" height="4" />
          <rect x="2" y="8" width="2" height="2" />
          <rect x="12" y="8" width="2" height="2" />
          <rect x="3" y="9" width="10" height="2" />
          <rect x="4" y="11" width="8" height="2" />
          <rect x="5" y="12" width="6" height="2" />
          <rect x="6" y="13" width="4" height="1" />
          <rect x="7" y="14" width="2" height="1" />
        </g>
      </svg>
    );
  if (kind === "BROWSER")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16">
        <g fill="currentColor">
          <rect x="1" y="2" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="1" y="2" width="14" height="3" />
          <rect x="3" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="5" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="7" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="3" y="7" width="4" height="1" />
          <rect x="3" y="9" width="6" height="1" />
          <rect x="3" y="11" width="3" height="1" />
        </g>
      </svg>
    );
  if (kind === "PLANT")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16">
        <g fill="currentColor">
          <rect x="7" y="2" width="2" height="10" />
          <rect x="4" y="4" width="3" height="2" />
          <rect x="9" y="6" width="3" height="2" />
          <rect x="3" y="3" width="2" height="2" />
          <rect x="11" y="5" width="2" height="2" />
          <rect x="3" y="12" width="10" height="2" />
          <rect x="4" y="14" width="8" height="1" />
        </g>
      </svg>
    );
  return null;
}

export default function About() {
  const [form, setForm] = useState({ name: "", email: "", msg: "" });
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sentName, setSentName] = useState("");

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    const name = form.name.trim();
    const email = form.email.trim();
    const msg = form.msg.trim();

    // Validación client-side: no vacíos + formato de email. No llama al endpoint si falla.
    if (!name || !email || !msg || !EMAIL_RE.test(email)) {
      triggerShake();
      return;
    }

    setErrorMsg("");
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, msg, honeypot }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (data.ok) {
        setSentName(name);
        setStatus("success");
      } else {
        setErrorMsg(data.error || "No se pudo enviar el mensaje. Intenta de nuevo.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("No se pudo conectar. Revisa tu conexión e intenta de nuevo.");
      setStatus("error");
    }
  };

  const reset = () => {
    setForm({ name: "", email: "", msg: "" });
    setHoneypot("");
    setErrorMsg("");
    setStatus("idle");
  };

  const sending = status === "sending";

  useReveal();

  return (
    <div className="about fade-in">
      {/* ABOUT */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y
          celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en
          cualquier lugar y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.i}
              className={"highlight " + h.c}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={h.i} />
              <div className="hl-text pixel">{h.t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider banner */}
      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      {/* CONTACT */}
      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip">
                <span className="tip-led"></span>RESPUESTA EN 24-48H
              </div>
              <div className="tip">
                <span className="tip-led y"></span>SUGERENCIAS BIENVENIDAS
              </div>
              <div className="tip">
                <span className="tip-led m"></span>SIN SPAM, JAMÁS
              </div>
            </div>
          </div>

          <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
            {status !== "success" ? (
              <>
                <div className="field">
                  <label htmlFor="cf-name">NOMBRE</label>
                  <input
                    id="cf-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="px_kai"
                    disabled={sending}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cf-email">CORREO ELECTRÓNICO</label>
                  <input
                    id="cf-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jugador@vault.gg"
                    disabled={sending}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cf-msg">MENSAJE</label>
                  <textarea
                    id="cf-msg"
                    rows={5}
                    value={form.msg}
                    onChange={(e) => setForm({ ...form, msg: e.target.value })}
                    placeholder="Cuéntanos qué tienes en mente…"
                    disabled={sending}
                  />
                </div>

                {/* Honeypot: oculto de forma accesible (fuera de pantalla, sin foco ni lectura). */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="cf-company">No llenar este campo</label>
                  <input
                    id="cf-company"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {status === "error" && (
                  <div
                    role="alert"
                    style={{
                      border: "1px solid var(--magenta)",
                      background: "rgba(255,0,110,0.08)",
                      color: "var(--magenta)",
                      fontFamily: "var(--mono)",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      padding: "10px 12px",
                      margin: "0 0 14px",
                    }}
                  >
                    ⚠ {errorMsg}
                  </div>
                )}

                <button
                  className="btn xl press"
                  type="submit"
                  style={{ width: "100%" }}
                  disabled={sending}
                >
                  {sending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
                </button>
              </>
            ) : (
              <div className="terminal-success">
                <div className="term-bar">
                  <span className="dot r"></span>
                  <span className="dot y"></span>
                  <span className="dot g"></span>
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line">
                    <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
                  </div>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line dim">[OK] Validando contenido…</div>
                  <div className="line dim">[OK] Transmitiendo paquete…</div>
                  <div className="line success">
                    &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
                    {sentName.toUpperCase()}.<span className="caret">_</span>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn ghost" type="button" onClick={reset}>
                      ENVIAR OTRO MENSAJE
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
