import nodemailer from 'nodemailer';
import { emailDeliveryEnabled } from '../config/runtime.js';

const BRAND = {
  name: 'Helena Martins',
  descriptor: 'Psicologia & Escuta',
  background: '#f3f1ea',
  surface: '#fffdf8',
  ink: '#202622',
  muted: '#636b63',
  forest: '#25352f',
  sage: '#89988a',
  sageLight: '#e8ece6',
  floral: '#a86775',
  border: '#d9d9d1',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildLoginCodeEmail(code) {
  const safeCode = escapeHtml(code);
  const subject = `Confirme seu e-mail — ${BRAND.name}`;
  const text = [
    'Confirme seu e-mail',
    '',
    `Seu código de confirmação é: ${code}`,
    '',
    'Ele vale por 10 minutos e só pode ser usado uma vez.',
    'Para sua segurança, não compartilhe este código.',
    '',
    'Se você não criou ou tentou confirmar esta conta, ignore esta mensagem.',
    '',
    `${BRAND.name} — ${BRAND.descriptor}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table { border-collapse: collapse !important; }
    body { width: 100% !important; min-width: 100%; height: 100% !important; margin: 0 !important; padding: 0 !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 620px) {
      .email-shell { padding: 16px 12px !important; }
      .email-card { width: 100% !important; }
      .header-cell { padding: 28px 24px 24px !important; }
      .content-cell { padding: 36px 24px 32px !important; }
      .footer-cell { padding: 24px !important; }
      .email-title { font-size: 34px !important; line-height: 38px !important; }
      .code-cell { font-size: 32px !important; letter-spacing: 7px !important; padding: 20px 12px 20px 19px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.background}; color:${BRAND.ink};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
    Use o código ${safeCode} para confirmar seu e-mail. Ele vale por 10 minutos.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:${BRAND.background};">
    <tr>
      <td class="email-shell" align="center" style="padding:40px 16px;">
        <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${BRAND.surface}; border:1px solid ${BRAND.border};">
          <tr>
            <td class="header-cell" style="padding:32px 40px 28px; background-color:${BRAND.forest}; border-bottom:4px solid ${BRAND.sage};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <p style="margin:0 0 7px; color:#c6d1be; font-family:Arial, Helvetica, sans-serif; font-size:10px; font-weight:bold; line-height:14px; letter-spacing:2px; text-transform:uppercase;">${BRAND.descriptor}</p>
                    <p style="margin:0; color:${BRAND.background}; font-family:Georgia, 'Times New Roman', serif; font-size:27px; font-weight:normal; line-height:31px;">${BRAND.name}</p>
                  </td>
                  <td width="48" valign="middle" align="right">
                    <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0" style="width:44px; height:44px;">
                      <tr><td align="center" valign="middle" width="42" height="42" style="width:42px; height:42px; border:1px solid #75847b; border-radius:50%; color:${BRAND.background}; font-family:Georgia, 'Times New Roman', serif; font-size:16px; line-height:42px;">HM</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="content-cell" style="padding:48px 48px 40px;">
              <p style="margin:0 0 18px; color:${BRAND.floral}; font-family:Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; line-height:16px; letter-spacing:1.8px; text-transform:uppercase;">Confirmação de conta</p>
              <h1 class="email-title" style="margin:0 0 20px; color:${BRAND.ink}; font-family:Georgia, 'Times New Roman', serif; font-size:42px; font-weight:normal; line-height:46px; letter-spacing:-.7px;">Só falta confirmar<br>seu e-mail.</h1>
              <p style="margin:0 0 30px; color:${BRAND.muted}; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:26px;">Digite o código abaixo na tela de confirmação para concluir seu acesso.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin:0 0 24px;">
                <tr>
                  <td class="code-cell" align="center" style="padding:24px 16px 24px 25px; background-color:${BRAND.sageLight}; border:1px solid #cfd7ce; color:${BRAND.forest}; font-family:'Courier New', Courier, monospace; font-size:38px; font-weight:bold; line-height:42px; letter-spacing:9px; font-variant-numeric:tabular-nums;">
                    ${safeCode}
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="padding:7px 12px; background-color:${BRAND.forest}; color:${BRAND.background}; font-family:Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; line-height:16px; letter-spacing:.7px; text-transform:uppercase;">Válido por 10 minutos</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-top:1px solid ${BRAND.border};">
                <tr>
                  <td width="20" valign="top" style="padding:24px 0 0; color:${BRAND.floral}; font-family:Georgia, 'Times New Roman', serif; font-size:22px; line-height:22px;">&#9679;</td>
                  <td valign="top" style="padding:23px 0 0 8px; color:${BRAND.muted}; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:21px;"><strong style="color:${BRAND.ink};">Cuide do seu código.</strong> Ele só pode ser usado uma vez. A equipe nunca pedirá que você o compartilhe por mensagem ou ligação.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="footer-cell" style="padding:28px 48px; background-color:#ecebe4; border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 7px; color:${BRAND.ink}; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px;">Não reconhece esta solicitação?</p>
              <p style="margin:0; color:${BRAND.muted}; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px;">Pode ignorar este e-mail com segurança. Nenhuma alteração será feita em sua conta.</p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0; color:${BRAND.muted}; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:18px; text-align:center;">Mensagem automática de ${BRAND.name}. Por favor, não responda.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function formatAppointmentDate(value) {
  const normalized = String(value || '');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  if (!match) return 'data e horário a confirmar';
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'data e horário a confirmar';
  const datePart = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(date);
  return `${datePart} às ${match[4]}`;
}

const appointmentCopy = {
  solicitacao: { label: 'Solicitação recebida', title: 'Recebemos seu pedido de atendimento.', body: 'Sua solicitação foi registrada e será analisada com atenção. Este e-mail ainda não confirma a consulta.', guidance: 'Você receberá uma nova mensagem assim que houver uma atualização.' },
  confirmacao: { label: 'Consulta confirmada', title: 'Sua consulta foi confirmada.', body: 'Reservamos este horário para você. Se precisar de algum ajuste, entre em contato pelos canais habituais.', guidance: 'Guarde esta mensagem para consultar a data e o horário do atendimento.' },
  conclusao: { label: 'Atendimento concluído', title: 'Seu atendimento foi registrado como concluído.', body: 'Agradecemos pela sua presença. Nenhuma informação clínica é enviada por e-mail.', guidance: 'Caso precise falar sobre um novo horário, entre em contato pelos canais habituais.' },
  cancelamento: { label: 'Consulta cancelada', title: 'Sua consulta foi cancelada.', body: 'O horário abaixo não está mais reservado. Você pode solicitar um novo agendamento quando for conveniente.', guidance: 'Se tiver dúvidas, fale com a profissional pelos canais habituais.' },
  reagendamento: { label: 'Horário atualizado', title: 'Sua consulta foi reagendada.', body: 'Atualizamos a data e o horário do seu atendimento. Confira os dados abaixo.', guidance: 'Guarde esta mensagem para consultar a nova data e horário.' },
  recusa: { label: 'Atualização da solicitação', title: 'Não foi possível aprovar sua solicitação.', body: 'Agradecemos seu contato. Neste momento, o horário solicitado não poderá ser confirmado.', guidance: 'Você pode solicitar outro horário disponível quando for conveniente.' },
};

export function buildAppointmentEmail(type, appointment) {
  const copy = appointmentCopy[type];
  if (!copy) throw new Error('INVALID_NOTIFICATION_EVENT');
  const name = escapeHtml(String(appointment?.nome || '')) || 'olá';
  const professional = escapeHtml(String(appointment?.profissionalNome || BRAND.name));
  const schedule = escapeHtml(formatAppointmentDate(appointment?.inicio));
  const modality = appointment?.modalidade === 'presencial' ? 'Presencial' : 'Online';
  const subject = `${copy.label} — ${BRAND.name}`;
  const text = [`Olá, ${appointment?.nome || ''}.`, '', copy.title, copy.body, '', `Data e horário: ${formatAppointmentDate(appointment?.inicio)}`, `Modalidade: ${modality}`, `Profissional: ${appointment?.profissionalNome || BRAND.name}`, '', copy.guidance, '', `${BRAND.name} — ${BRAND.descriptor}`].join('\n');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head><body style="margin:0;padding:0;background:${BRAND.background};color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.background};"><tr><td align="center" style="padding:32px 14px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;background:${BRAND.surface};border:1px solid ${BRAND.border};"><tr><td style="padding:28px 36px;background:${BRAND.forest};border-bottom:4px solid ${BRAND.sage};"><p style="margin:0 0 6px;color:#c6d1be;font-size:10px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;">${BRAND.descriptor}</p><p style="margin:0;color:${BRAND.background};font-family:Georgia,serif;font-size:27px;">${professional}</p></td></tr><tr><td style="padding:38px 36px;"><p style="margin:0 0 14px;color:${BRAND.floral};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">${copy.label}</p><h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;font-weight:normal;line-height:1.12;">${copy.title}</h1><p style="margin:0 0 22px;color:${BRAND.muted};font-size:16px;line-height:1.7;">Olá, ${name}. ${copy.body}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND.border};background:${BRAND.sageLight};"><tr><td style="padding:18px 20px;"><p style="margin:0 0 6px;color:${BRAND.muted};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Data e horário</p><p style="margin:0;color:${BRAND.forest};font-family:Georgia,serif;font-size:20px;line-height:1.35;">${schedule}</p><p style="margin:12px 0 0;color:${BRAND.muted};font-size:13px;">Modalidade: ${modality}</p></td></tr></table><p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px;line-height:1.65;">${copy.guidance}</p></td></tr><tr><td style="padding:22px 36px;background:#ecebe4;color:${BRAND.muted};font-size:11px;line-height:1.6;">Mensagem automática de ${BRAND.name}. Para proteger sua privacidade, ela não contém informações clínicas.</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

let transport;
async function sendWithSmtp(to, message) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) throw new Error('SMTP_NOT_CONFIGURED');
  const port = Number(process.env.SMTP_PORT || 587);
  transport ||= nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const result = await transport.sendMail({ from: SMTP_FROM, to, ...message });
  if (!result.accepted?.length) throw new Error('SMTP_RECIPIENT_REJECTED');
}

async function sendWithResend(to, message) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!apiKey || !from) throw new Error('RESEND_NOT_CONFIGURED');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: message.subject, text: message.text, html: message.html }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('RESEND_REQUEST_FAILED');
    error.code = `RESEND_HTTP_${response.status}`;
    throw error;
  }
  // A successful Resend submission includes a message id. Requiring it keeps
  // the persistent notification queue from marking ambiguous 2xx responses as sent.
  if (typeof result?.id !== 'string' || !result.id.trim()) {
    throw new Error('RESEND_CONFIRMATION_MISSING');
  }
  return { provider: 'resend', id: result.id };
}

export async function sendEmailMessage(to, message) {
  if (!emailDeliveryEnabled()) throw new Error('EMAIL_DELIVERY_DISABLED');
  const provider = String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'smtp')).toLowerCase();
  if (provider === 'resend') return sendWithResend(to, message);
  if (provider === 'smtp') return sendWithSmtp(to, message);
  throw new Error('EMAIL_PROVIDER_INVALID');
}

export async function sendLoginCode(email, code) {
  return sendEmailMessage(email, buildLoginCodeEmail(code));
}

export async function sendAppointmentEmail(email, type, appointment) {
  return sendEmailMessage(email, buildAppointmentEmail(type, appointment));
}
