import { Resend } from 'resend';
import { SITE_URL } from './site';
import { serverSupabase } from './blog';

export const FROM_EMAIL = 'Camber Co <noreply@camberco.co.uk>';
export const ADMIN_EMAIL = 'charlie@camberco.co.uk';
export const REPLY_TO = 'hello@camberco.co.uk';

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
const ctaButtonStyle = `display: inline-block; background: #22c55e; color: #000; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; text-decoration: none;`;

export async function sendAdminNotification(data: EnquiryData): Promise<void> {
  const resend = getResend();

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 24px 0;">$ new CamberCo enquiry</h2>

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
        <a href="${SITE_URL}/admin/enquiries" style="color: #22c55e; text-decoration: none; font-size: 13px;">→ view in dashboard</a>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    replyTo: data.email,
    subject: `New CamberCo enquiry from ${data.name}`,
    html,
  });
  if (error) throw new Error(`Admin notification failed: ${error.message}`);
}

export async function sendSenderConfirmation(data: EnquiryData): Promise<void> {
  const resend = getResend();

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ thanks for reaching out</h2>

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${escapeHtml(data.name)}, thanks for getting in touch with Camber Co.
        Charlie will review your enquiry and get back to you within one working day.
      </p>

      <div style="background: #111111; border: 1px solid #1f1f1f; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <p style="${labelStyle} margin: 0 0 8px 0;">what you submitted</p>
        <p style="color: #d0d0d0; margin: 0 0 4px 0;"><strong style="color: #f0f0f0;">Service:</strong> ${escapeHtml(data.service)}</p>
        <p style="color: #d0d0d0; margin: 0; white-space: pre-wrap;"><strong style="color: #f0f0f0;">Message:</strong> ${escapeHtml(data.message)}</p>
      </div>

      <p style="${mutedText} font-size: 13px; margin: 0;">
        Camber Co. The AI consultant who builds.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.email,
    replyTo: REPLY_TO,
    subject: 'Thanks for reaching out to Camber Co',
    html,
  });
  if (error) throw new Error(`Sender confirmation failed: ${error.message}`);
}

export async function sendSubscribeConfirmation(
  subscriberEmail: string,
  unsubscribeToken: string,
): Promise<void> {
  const resend = getResend();
  const confirmUrl = `${SITE_URL}/api/confirm-subscription?token=${unsubscribeToken}`;

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ confirm your subscription</h2>

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        You asked to receive new posts from Camber Co. Click below to confirm.
      </p>

      <a href="${confirmUrl}" style="${ctaButtonStyle}">&gt; Confirm Subscription</a>

      <p style="${mutedText} font-size: 13px; margin: 24px 0 0 0;">
        If you did not request this, just ignore this email.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: subscriberEmail,
    replyTo: REPLY_TO,
    subject: 'Confirm your Camber Co subscription',
    html,
  });
  if (error) throw new Error(`Subscribe confirmation failed: ${error.message}`);
}

export async function sendSubscriberAlert(subscriberEmail: string): Promise<void> {
  const resend = getResend();

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ new newsletter subscriber</h2>
      <p style="color: #d0d0d0; line-height: 1.6; margin: 0;">
        <a href="mailto:${escapeHtml(subscriberEmail)}" style="color: #4ade80; text-decoration: none;">${escapeHtml(subscriberEmail)}</a>
        just confirmed their subscription.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    replyTo: subscriberEmail,
    subject: `New subscriber: ${subscriberEmail}`,
    html,
  });
  if (error) throw new Error(`Subscriber alert failed: ${error.message}`);
}

export async function sendWelcomeEmail(
  subscriberEmail: string,
  unsubscribeToken: string,
): Promise<void> {
  const resend = getResend();
  const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

  let posts: { title: string; slug: string }[] = [];
  try {
    const supabase = serverSupabase();
    const { data } = await supabase
      .from('blog_drafts')
      .select('title, slug')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3);
    posts = data ?? [];
  } catch (err) {
    console.error('Welcome email: failed to fetch posts:', err);
  }

  const postList = posts.length
    ? `
      <p style="${labelStyle} margin: 0 0 8px 0;">start here</p>
      <ul style="margin: 0 0 24px 0; padding: 0 0 0 18px; color: #d0d0d0;">
        ${posts
          .map(
            (p) =>
              `<li style="margin: 0 0 8px 0;"><a href="${SITE_URL}/blog/${p.slug}/" style="color: #4ade80; text-decoration: none;">${escapeHtml(p.title)}</a></li>`,
          )
          .join('')}
      </ul>
    `
    : `
      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        <a href="${SITE_URL}/blog/" style="color: #4ade80; text-decoration: none;">Browse the blog</a> for practical writing on AI and automation.
      </p>
    `;

  const html = `
    <div style="${terminalStyles}">
      <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ welcome to Camber Co</h2>

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        Thanks for confirming. You will get each new post by email.
        Short, practical writing on AI and automation for small businesses. No spam.
      </p>

      ${postList}

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 16px 0;">
        Got a process that eats your week? The 30-minute audit call is free.
        No pitch, just a look at what could run itself.
      </p>

      <a href="${SITE_URL}/contact" style="${ctaButtonStyle}">&gt; Book a Free Audit Call</a>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
        <p style="${mutedText} font-size: 11px; margin: 0;">
          You received this because you subscribed at camberco.co.uk.
          <a href="${unsubUrl}" style="color: #8a8a8a; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: subscriberEmail,
    replyTo: REPLY_TO,
    subject: 'Welcome to Camber Co',
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  if (error) throw new Error(`Welcome email failed: ${error.message}`);
}

interface BlogDigestData {
  title: string;
  slug: string;
  description: string;
  author: string;
}

interface Subscriber {
  email: string;
  unsubscribe_token: string;
}

export interface DigestEmail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  headers: Record<string, string>;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function buildDigestBatch(subscribers: Subscriber[], post: BlogDigestData): DigestEmail[] {
  const postUrl = `${SITE_URL}/blog/${post.slug}/`;

  return subscribers.map((sub) => {
    const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ new post from Camber Co</h2>

        <h3 style="color: #f0f0f0; font-size: 20px; margin: 0 0 12px 0; font-family: 'JetBrains Mono', monospace;">${escapeHtml(post.title)}</h3>

        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
          ${escapeHtml(post.description)}
        </p>

        <a href="${postUrl}" style="${ctaButtonStyle}">&gt; Read the Post</a>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
          <p style="${mutedText} font-size: 11px; margin: 0;">
            You received this because you subscribed to Camber Co.
            <a href="${unsubUrl}" style="color: #8a8a8a; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    return {
      from: FROM_EMAIL,
      to: sub.email,
      replyTo: REPLY_TO,
      subject: `New post: ${post.title}`,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  });
}

export async function sendBlogDigest(subscribers: Subscriber[], post: BlogDigestData): Promise<void> {
  const resend = getResend();

  for (const batch of chunk(buildDigestBatch(subscribers, post), 100)) {
    const { error } = await resend.batch.send(batch);
    if (error) console.error('Digest batch failed:', error);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
