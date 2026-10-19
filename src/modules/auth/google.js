const { OAuth2Client } = require('google-auth-library');

// Verificación del ID token de "Continuar con Google" (Google Identity
// Services en la web). Nunca se confía en datos que mande el cliente: el
// nombre, el correo y el identificador salen del token ya verificado aquí.
//
//   - firma de Google y vencimiento (exp): verifyIdToken
//   - audiencia = GOOGLE_CLIENT_ID (el Client ID web de Google Cloud)
//   - emisor = accounts.google.com
//   - email_verified = true
//
// Scopes que pide la web: openid, email y profile (lo que trae el ID token
// de Google Identity Services); no se pide nada más.

const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

let cliente = null;
const oauth = () => (cliente ||= new OAuth2Client());

const disponible = () => !!process.env.GOOGLE_CLIENT_ID;

/** @returns {{ sub, email, nombre }} datos verificados de la cuenta de Google */
const verificarCredencial = async (credential) => {
  if (!disponible()) throw { status: 503, message: 'El inicio de sesión con Google no está disponible' };

  let payload;
  try {
    const ticket = await oauth().verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw { status: 401, message: 'No pudimos verificar tu cuenta de Google. Intenta de nuevo.' };
  }

  if (!payload || !EMISORES.includes(payload.iss) || payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw { status: 401, message: 'No pudimos verificar tu cuenta de Google. Intenta de nuevo.' };
  }
  if (payload.email_verified !== true || !payload.email || !payload.sub) {
    throw { status: 401, message: 'Tu cuenta de Google no tiene un correo verificado' };
  }

  return {
    sub:    String(payload.sub),
    email:  String(payload.email).trim().toLowerCase(),
    nombre: typeof payload.name === 'string' ? payload.name : '',
  };
};

module.exports = { verificarCredencial, disponible };
