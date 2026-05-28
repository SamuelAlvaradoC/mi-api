const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'ChocoFreseo <onboarding@resend.dev>';

const baseHTML = (contenido) => `
<div style="font-family:Arial,sans-serif;max-width:520px;
  margin:0 auto;background:#fff;border-radius:12px;
  overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#CA0B0B;padding:24px;text-align:center;">
    <img
      src="https://res.cloudinary.com/dnoxlv5kn/image/upload/v1778822634/logo_sin_fondo_remove_uuu8tt.png"
      alt="ChocoFreseo"
      style="height:60px;object-fit:contain;"
    />
    <h1 style="color:white;margin:8px 0 0;font-size:22px;font-weight:900;">
      ChocoFreseo
    </h1>
  </div>
  <div style="padding:28px 32px;">
    ${contenido}
  </div>
  <div style="background:#f9f9f9;padding:16px;text-align:center;
    border-top:1px solid #f0f0f0;">
    <p style="color:#aaa;font-size:11px;margin:0;">
      © 2026 ChocoFreseo · Cl. 90 #50d-35, Aranjuez, Medellín<br/>
      WhatsApp: 315-991-46-24 · Lunes a domingo 1PM - 8PM
    </p>
  </div>
</div>
`;

// 1. BIENVENIDA
const enviarBienvenida = async (email, nombre) => {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '¡Bienvenido a ChocoFreseo! 🍓🍫',
    html: baseHTML(`
      <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;">
        ¡Hola, ${nombre}! 👋
      </h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Tu cuenta en <strong>ChocoFreseo</strong> fue creada exitosamente.
        Ya puedes explorar nuestro catálogo y hacer tu primer pedido.
      </p>
      <div style="background:#fff5f5;border-radius:10px;padding:16px;
        margin-bottom:20px;border-left:4px solid #CA0B0B;">
        <p style="margin:0;font-size:13px;color:#555;">
          🍓 Fresas con crema · 🍫 Fondues · 🍪 Brownies y más<br/>
          <strong style="color:#CA0B0B;">Domicilios todos los días de 1PM a 8PM</strong>
        </p>
      </div>
      <div style="text-align:center;">
        <a href="https://chocofreseo.com/catalogo"
          style="display:inline-block;background:#CA0B0B;color:white;
            text-decoration:none;padding:12px 32px;border-radius:8px;
            font-weight:700;font-size:14px;">
          Ver catálogo 🛍️
        </a>
      </div>
    `)
  });
};

// 2. ALERTA LOGIN
const enviarAlertaLogin = async (email, nombre) => {
  const fecha = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short'
  });
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '🔐 Nuevo inicio de sesión en tu cuenta - ChocoFreseo',
    html: baseHTML(`
      <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;">
        Nuevo inicio de sesión
      </h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hola <strong>${nombre}</strong>, detectamos un inicio de sesión
        en tu cuenta de ChocoFreseo.
      </p>
      <div style="background:#f9f9f9;border-radius:10px;padding:16px;
        margin-bottom:20px;">
        <div style="padding:6px 0;border-bottom:1px solid #f0f0f0;
          font-size:13px;display:flex;justify-content:space-between;">
          <span style="color:#888;">Fecha y hora</span>
          <span style="font-weight:700;color:#1a1a1a;">${fecha}</span>
        </div>
        <div style="padding:6px 0;font-size:13px;display:flex;
          justify-content:space-between;">
          <span style="color:#888;">Cuenta</span>
          <span style="font-weight:700;color:#1a1a1a;">${email}</span>
        </div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:12px 16px;
        border-left:4px solid #f59e0b;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          ⚠️ Si no fuiste tú, cambia tu contraseña inmediatamente
          desde la sección de perfil.
        </p>
      </div>
    `)
  });
};

// 3. RECUPERAR CONTRASEÑA
const enviarCodigoRecuperacion = async (email, codigo) => {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '🔐 Código para recuperar tu contraseña - ChocoFreseo',
    html: baseHTML(`
      <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;">
        Recupera tu contraseña
      </h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta.
        Usa el siguiente código:
      </p>
      <div style="background:#fff5f5;border:2px solid #CA0B0B;
        border-radius:12px;padding:24px;text-align:center;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 8px;">
          Código de verificación
        </p>
        <h1 style="color:#CA0B0B;font-size:48px;letter-spacing:8px;
          margin:0;font-weight:900;">
          ${codigo}
        </h1>
        <p style="color:#888;font-size:12px;margin:8px 0 0;">
          Válido por 15 minutos
        </p>
      </div>
      <p style="color:#888;font-size:12px;text-align:center;">
        Si no solicitaste este cambio, ignora este email.
      </p>
    `)
  });
};

module.exports = { enviarBienvenida, enviarAlertaLogin, enviarCodigoRecuperacion };
