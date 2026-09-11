import nodemailer from 'nodemailer';

let transport;
export async function sendLoginCode(email, code) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) throw new Error('SMTP_NOT_CONFIGURED');
  const port = Number(process.env.SMTP_PORT || 587);
  transport ||= nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const result = await transport.sendMail({
    from: SMTP_FROM, to: email, subject: 'Seu código de acesso — Helena Martins',
    text: `Seu código de acesso é: ${code}\n\nEle vale por 10 minutos e só pode ser usado uma vez. Não compartilhe este código.\n\nSe você não solicitou este acesso, ignore esta mensagem.`,
  });
  if (!result.accepted?.length) throw new Error('SMTP_RECIPIENT_REJECTED');
}
