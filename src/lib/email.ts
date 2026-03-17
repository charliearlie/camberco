import { Resend } from 'resend';

const FROM_EMAIL = 'noreply@camberco.co.uk';
const ADMIN_EMAIL = 'charlie@camberco.co.uk';

function getResend(): Resend {
  const key = import.meta.env.RESEND_API_KEY ?? '';
  return new Resend(key);
}

interface EnquiryData {
  name: string;
  email: string;
  company?: string;
  service: string;
  message: string;
  source: 'form' | 'bot';
}

const terminalStyles = `
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  background: #0a0a0a;
  color: #f0f0f0;
  padding: 32px;
  border-radius: 8px;
`;

const greenText = 'color: #22c55e;';
const mutedText = 'color: #8a8a8a;';
const labelStyle = `${mutedText} font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;`;

export async function sendAdminNotification(data: EnquiryData): Promise<void> {
  const resend = getResend();

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 24px 0;">$ new enquiry received</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top; width: 100px;">name</td>
          <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.name)}</td>
        </tr>
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">email</td>
          <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color: #4ade80; text-decoration: none;">${escapeHtml(data.email)}</a></td>
        </tr>
        ${data.company ? `
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">company</td>
          <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.company)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">service</td>
          <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.service)}</td>
        </tr>
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">source</td>
          <td style="padding: 8px 0; color: #f0f0f0;">${data.source === 'bot' ? 'AI chat' : 'Contact form'}</td>
        </tr>
        <tr>
          <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">message</td>
          <td style="padding: 8px 0; color: #f0f0f0; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
        <a href="https://camberco.co.uk/admin/enquiries" style="color: #22c55e; text-decoration: none; font-size: 13px;">→ view in dashboard</a>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New enquiry from ${data.name}`,
    html,
  });
}

export async function sendSenderConfirmation(data: EnquiryData): Promise<void> {
  const resend = getResend();

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ thanks for reaching out</h2>

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${escapeHtml(data.name)}, thanks for getting in touch with Camber Co.
        Charlie will review your enquiry and get back to you shortly.
      </p>

      <div style="background: #111111; border: 1px solid #1f1f1f; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <p style="${labelStyle} margin: 0 0 8px 0;">what you submitted</p>
        <p style="color: #d0d0d0; margin: 0 0 4px 0;"><strong style="color: #f0f0f0;">Service:</strong> ${escapeHtml(data.service)}</p>
        <p style="color: #d0d0d0; margin: 0; white-space: pre-wrap;"><strong style="color: #f0f0f0;">Message:</strong> ${escapeHtml(data.message)}</p>
      </div>

      <p style="${mutedText} font-size: 13px; margin: 0;">
        Camber Co — AI services for founders who move fast.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.email,
    subject: 'Thanks for reaching out to Camber Co',
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
