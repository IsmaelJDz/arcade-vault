import { Resend } from "resend";

// Contrato del endpoint (ver spec 03).
interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  honeypot: string; // debe llegar vacío; si no, se descarta silenciosamente
}

type ContactResponse = { ok: true } | { ok: false; error: string };

// Mismo criterio de "email válido" que el cliente (regex básico).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: ContactResponse, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  // Validar configuración antes de nada: sin env vars el envío siempre fallaría
  // de forma poco evidente. Respondemos con un mensaje claro.
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return json(
      {
        ok: false,
        error:
          "Configuración de correo incompleta. Falta RESEND_API_KEY, CONTACT_TO_EMAIL o CONTACT_FROM_EMAIL en el servidor.",
      },
      500,
    );
  }

  // Parseo defensivo del body.
  let payload: Partial<ContactPayload>;
  try {
    payload = (await request.json()) as Partial<ContactPayload>;
  } catch {
    return json({ ok: false, error: "Cuerpo de la petición inválido." }, 400);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const msg = typeof payload.msg === "string" ? payload.msg.trim() : "";
  const honeypot = typeof payload.honeypot === "string" ? payload.honeypot : "";

  // Honeypot: si viene lleno es un bot. Descartamos silenciosamente
  // (respondemos éxito, sin llamar a Resend, para no dar pistas).
  if (honeypot.trim() !== "") {
    return json({ ok: true }, 200);
  }

  // Validación server-side (defensa adicional a la del cliente).
  if (!name || !email || !msg) {
    return json({ ok: false, error: "Todos los campos son obligatorios." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "El correo electrónico no es válido." }, 400);
  }

  // Envío vía Resend.
  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: `Arcade Vault <${fromEmail}>`,
      to: [toEmail],
      replyTo: email,
      subject: `Nuevo mensaje de contacto — ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });

    if (error) {
      return json(
        { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
        502,
      );
    }
  } catch {
    return json(
      { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
      502,
    );
  }

  return json({ ok: true }, 200);
}
