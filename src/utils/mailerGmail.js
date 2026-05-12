const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const enviarCodigoRecuperacion = async (email, codigo) => {
  const info = await transporter.sendMail({
    from: `"ChocoFreseo 🍫" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🔐 Código para recuperar tu contraseña - ChocoFreseo',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#CA0B0B;font-size:28px;margin:0;">🍫 ChocoFreseo</h1>
        </div>
        <h2 style="color:#1a1a1a;font-size:20px;">Recupera tu contraseña</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta.
          Usa el siguiente código para continuar:
        </p>
        <div style="background:#fff5f5;border:2px solid #CA0B0B;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
          <p style="color:#888;font-size:12px;margin:0 0 8px;">Tu código de verificación</p>
          <h1 style="color:#CA0B0B;font-size:48px;letter-spacing:8px;margin:0;font-weight:900;">${codigo}</h1>
          <p style="color:#888;font-size:12px;margin:8px 0 0;">Válido por 15 minutos</p>
        </div>
        <p style="color:#555;font-size:13px;">
          Si no solicitaste este cambio, puedes ignorar este email.
          Tu contraseña actual seguirá siendo la misma.
        </p>
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;" />
        <p style="color:#aaa;font-size:11px;text-align:center;">
          © 2026 ChocoFreseo · Medellín, Colombia
        </p>
      </div>
    `,
  });
  return info;
};

module.exports = { enviarCodigoRecuperacion };
