/**
 * Email System for Quantovest Capital
 * 
 * Architecture:
 * 1. Event helper — receives a business event (e.g., deposit_approved)
 * 2. Template renderer — loads the correct template with server-derived variables
 * 3. Outbox — stores pending emails for retry
 * 4. Provider adapter — sends via Resend/SendGrid/SES
 * 
 * To activate: set ZOHO_SMTP_USER, ZOHO_SMTP_PASS and EMAIL_FROM in .env.local
 * Without these, emails are logged to console but not sent.
 */

const APP_URL = process.env.APP_PUBLIC_URL || 'http://localhost:3000';

if (!process.env.APP_PUBLIC_URL) {
  console.warn('[EMAIL] APP_PUBLIC_URL is not set — email template links will fall back to http://localhost:3000.');
}

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

type TemplateName =
  | 'account_welcome'
  | 'deposit_submitted'
  | 'deposit_approved'
  | 'deposit_rejected'
  | 'plan_updated'
  | 'roi_published'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_declined'
  | 'withdrawal_submitted'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'referral_reward_credited'
  | 'admin_broadcast'
  | 'security_alert';

interface TemplateData {
  investorName: string;
  amount?: string;
  planName?: string;
  roiPercent?: string;
  profitAmount?: string;
  reason?: string;
  previousPlan?: string;
  message?: string;
  adminName?: string;
  eventTime?: string;
}

function renderTemplate(name: TemplateName, data: TemplateData): EmailTemplate {
  const baseLayout = (title: string, content: string) => ({
    subject: title,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #0A0D0C; padding: 24px 32px; }
    .header h1 { color: #22C55E; font-size: 20px; font-weight: 600; margin: 0; }
    .body { padding: 32px; color: #1a1a1a; line-height: 1.6; }
    .body h2 { font-size: 18px; font-weight: 600; margin: 0 0 16px; }
    .highlight { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center; }
    .highlight .amount { font-size: 28px; font-weight: 700; color: #16a34a; font-family: 'SF Mono', Monaco, monospace; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #6b7280; }
    .detail-value { font-weight: 600; color: #111827; }
    .cta { display: inline-block; background: #22C55E; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 100px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .footer { padding: 24px 32px; background: #f8f9fa; font-size: 12px; color: #9ca3af; text-align: center; }
    .footer a { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Quantovest Capital</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Quantovest Capital — Your Capital. Their Expertise.</p>
      <p><a href="${esc(APP_URL)}/dashboard">View Dashboard</a> · <a href="${esc(APP_URL)}/legal/terms">Terms</a> · <a href="${esc(APP_URL)}/legal/privacy">Privacy</a></p>
      <p style="margin-top: 12px; font-size: 11px; color: #d1d5db;">
        Risk Warning: Trading involves substantial risk of loss. Past performance is not indicative of future results.
        You should not invest more than you can afford to lose. Please read our full risk disclosure.
      </p>
    </div>
  </div>
</body>
</html>`,
    text: `${title}\n\nHello ${esc(data.investorName)},\n\n${content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}\n\nView your dashboard: ${esc(APP_URL)}/dashboard\n\nQuantovest Capital — Your Capital. Their Expertise.`,
  });

  switch (name) {
    case 'account_welcome':
      return baseLayout('Welcome to Quantovest Capital', `
        <h2>Welcome aboard</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your Quantovest Capital account has been created. You can now fund your account, choose an investment plan, and follow professional traders.</p>
        <div class="detail-row"><span class="detail-label">Start Investing</span><span class="detail-value">From $1,500</span></div>
        <div class="detail-row"><span class="detail-label">Support</span><span class="detail-value"><a href="mailto:support@quantovests.com">support@quantovests.com</a></span></div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">Go to Dashboard</a>
      `);

    case 'deposit_submitted':
      return baseLayout('Deposit Received', `
        <h2>Deposit Received</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>We&apos;ve received your deposit request and it&apos;s now being reviewed.</p>
        <div class="highlight">
          <div class="amount">${esc(data.amount)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#f59e0b;font-weight:600">Pending Verification</p>
        </div>
        <p style="font-size:14px;color:#6b7280;">Our team will review your submission shortly. You&apos;ll receive an email once it&apos;s approved.</p>
      `);

    case 'deposit_approved':
      return baseLayout('Deposit Approved', `
        <h2>Deposit Approved</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your deposit has been approved and credited to your account.</p>
        <div class="highlight">
          <div class="amount">${esc(data.amount)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#16a34a;font-weight:600">Credited to ${esc(data.planName)} Plan</p>
        </div>
        <div class="detail-row"><span class="detail-label">Plan</span><span class="detail-value">${esc(data.planName)}</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${esc(data.amount)}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:#16a34a">Completed</span></div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">View Dashboard</a>
      `);

    case 'deposit_rejected':
      return baseLayout('Deposit Rejected', `
        <h2>Deposit Rejected</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your deposit request has been declined.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#dc2626;font-weight:600;margin:0;">Reason</p>
          <p style="margin:8px 0 0;color:#7f1d1d;">${esc(data.reason)}</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard/deposit" class="cta">Try Again</a>
      `);

    case 'plan_updated':
      return baseLayout('Plan Updated', `
        <h2>Plan Changed</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your investment plan has been updated.</p>
        <div class="highlight">
          <div class="amount">${esc(data.planName)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#16a34a;font-weight:600">New Active Plan</p>
        </div>
        <div class="detail-row"><span class="detail-label">Previous Plan</span><span class="detail-value">${esc(data.previousPlan)}</span></div>
        <div class="detail-row"><span class="detail-label">New Plan</span><span class="detail-value" style="color:#16a34a">${esc(data.planName)}</span></div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">View Dashboard</a>
      `);

    case 'roi_published':
      return baseLayout('Daily ROI Credited', `
        <h2>Daily ROI</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Today&apos;s return has been credited to your account.</p>
        <div class="highlight">
          <div class="amount">${esc(data.roiPercent)}%</div>
          <p style="margin:8px 0 0;font-size:14px;color:#16a34a;font-weight:600">+${esc(data.profitAmount)} added to balance</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">View Dashboard</a>
      `);

    case 'kyc_submitted':
      return baseLayout('KYC Documents Received', `
        <h2>Documents Received</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>We&apos;ve received your identity verification documents.</p>
        <div style="text-align:center;padding:20px;">
          <span style="display:inline-block;background:#fef3c7;color:#d97706;font-weight:700;font-size:16px;padding:8px 24px;border-radius:100px;">Under Review</span>
        </div>
        <p style="font-size:14px;color:#6b7280;">Our compliance team will review your documents within 24 hours.</p>
      `);

    case 'kyc_approved':
      return baseLayout('KYC Verified', `
        <h2>Identity Verified</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your identity verification has been approved. You now have full access to all platform features.</p>
        <div style="text-align:center;padding:20px;">
          <span style="display:inline-block;background:#f0fdf4;color:#16a34a;font-weight:700;font-size:16px;padding:8px 24px;border-radius:100px;">✓ Verified</span>
        </div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">Go to Dashboard</a>
      `);

    case 'kyc_declined':
      return baseLayout('KYC Requires Attention', `
        <h2>Verification Declined</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your identity verification was declined. Please review and resubmit.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#dc2626;font-weight:600;margin:0;">Reason</p>
          <p style="margin:8px 0 0;color:#7f1d1d;">${esc(data.reason)}</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard/kyc" class="cta">Resubmit Documents</a>
      `);

    case 'withdrawal_submitted':
      return baseLayout('Withdrawal Requested', `
        <h2>Withdrawal Request</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your withdrawal request has been submitted and is pending review.</p>
        <div class="highlight">
          <div class="amount">${esc(data.amount)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#f59e0b;font-weight:600">Pending Admin Approval</p>
        </div>
      `);

    case 'withdrawal_approved':
      return baseLayout('Withdrawal Processed', `
        <h2>Withdrawal Approved</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your withdrawal has been processed.</p>
        <div class="highlight">
          <div class="amount">${esc(data.amount)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#16a34a;font-weight:600">Completed</p>
        </div>
      `);

    case 'withdrawal_rejected':
      return baseLayout('Withdrawal Declined', `
        <h2>Withdrawal Declined</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>Your withdrawal request has been declined.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#dc2626;font-weight:600;margin:0;">Reason</p>
          <p style="margin:8px 0 0;color:#7f1d1d;">${esc(data.reason)}</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard/withdraw" class="cta">View Withdrawals</a>
      `);

    case 'referral_reward_credited':
      return baseLayout('Referral Reward', `
        <h2>Referral Reward</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>A referral reward has been credited to your account.</p>
        <div class="highlight">
          <div class="amount">${esc(data.amount)}</div>
          <p style="margin:8px 0 0;font-size:14px;color:#16a34a;font-weight:600">Referral Bonus</p>
        </div>
      `);

    case 'admin_broadcast':
      return baseLayout(esc(data.message) || 'Platform Notice', `
        <h2>${esc(data.message) || 'Platform Notice'}</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>${esc(data.adminName) || 'The Quantovest team'} has sent you an update:</p>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;">${esc(data.message)}</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard" class="cta">View Dashboard</a>
      `);

    case 'security_alert':
      return baseLayout('Security Alert', `
        <h2>Security Alert</h2>
        <p>Hello ${esc(data.investorName)},</p>
        <p>A security-related event occurred on your account.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#dc2626;font-weight:600;margin:0;">Event</p>
          <p style="margin:8px 0 0;color:#7f1d1d;">${esc(data.message)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Time: ${esc(data.eventTime)}</p>
        </div>
        <a href="${esc(APP_URL)}/dashboard/settings" class="cta">Review Security Settings</a>
      `);

    default:
      return baseLayout('Notification', `<p>Hello ${esc(data.investorName)},</p><p>You have a new notification.</p>`);
  }
}

// ─── Email Sender (Zoho SMTP) ────────────────────────────────────────────────

import tls from 'tls';
import net from 'net';

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'Quantovest Capital <support@quantovests.com>';

function smtpCommand(socket: net.Socket, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => { socket.off('data', onData); reject(new Error('SMTP command timed out.')); }, 15000);
    const onData = (chunk: Buffer) => {
      data += chunk.toString('utf8');
      // A reply is complete when a line ends with "\r\n<code> " (more to come) or
      // when the last char of the final line is a space is not definitive; SMTP
      // multi-line replies end when a line starts with "<code> " (space) rather than "-".
      const lines = data.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        clearTimeout(timer);
        socket.off('data', onData);
        resolve(data);
      }
    };
    socket.on('data', onData);
    socket.write(`${command}\r\n`);
  });
}

function base64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

async function sendViaZoho(
  host: string,
  port: number,
  user: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, async () => {
      try {
        const greeting = await smtpCommand(socket, '');
        if (!/^220/.test(greeting)) return resolve({ ok: false, message: 'Unexpected greeting: ' + greeting.trim() });
        await smtpCommand(socket, `EHLO ${host}`);
        await smtpCommand(socket, `AUTH LOGIN`);
        await smtpCommand(socket, base64(user));
        const authRes = await smtpCommand(socket, base64(password));
        if (!/^235/.test(authRes)) {
          socket.end();
          return resolve({ ok: false, message: 'Authentication failed: ' + authRes.trim() });
        }
        await smtpCommand(socket, `MAIL FROM:<${from}>`);
        const rcpt = await smtpCommand(socket, `RCPT TO:<${to}>`);
        if (!/^2\d\d/.test(rcpt)) { socket.end(); return resolve({ ok: false, message: 'Recipient rejected: ' + rcpt.trim() }); }
        await smtpCommand(socket, 'DATA');
        const msg = [
          `From: ${EMAIL_FROM}`,
          `To: <${to}>`,
          `Subject: ${subject.replace(/\r?\n/g, ' ')}`,
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: <${crypto.randomUUID()}@${(from.match(/@([^>]+)$/) || [])[1] || 'quantovests.com'}>`,
          `Return-Path: <${from}>`,
          'MIME-Version: 1.0',
          'Content-Type: multipart/alternative; boundary="qvb"',
          '',
          '--qvb',
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          text,
          '',
          '--qvb',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          '',
          '--qvb--',
        ];
        const bodyData = msg.map(line => line.startsWith('.') ? `.${line}` : line).join('\r\n');
        const dataRes = await smtpCommand(socket, `${bodyData}\r\n.`);
        socket.end();
        if (/^2\d\d/.test(dataRes)) return resolve({ ok: true, message: 'Sent' });
        return resolve({ ok: false, message: 'Data rejected: ' + dataRes.trim() });
      } catch (err) {
        socket.end();
        reject(err);
      }
    });
    socket.on('error', (err) => reject(err));
    socket.setTimeout(20000, () => { socket.destroy(); reject(new Error('SMTP connection timed out.')); });
  });
}

export async function sendEmail(
  to: string,
  templateName: TemplateName,
  data: TemplateData
): Promise<{ sent: boolean; error?: string }> {
  const template = renderTemplate(templateName, data);
  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
  const port = Number(process.env.ZOHO_SMTP_PORT || '465');
  const user = process.env.ZOHO_SMTP_USER;
  const password = process.env.ZOHO_SMTP_PASS;

  // Without credentials, log to console (development mode).
  // In production, report as unsent so callers can retry or surface it.
  if (!user || !password || /<FILL_|replace-with/i.test(user) || /<FILL_|replace-with/i.test(password)) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[EMAIL] Credentials missing — email not sent.');
      return { sent: false, error: 'Email service is not configured.' };
    }
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${template.subject}`);
    console.log(`[EMAIL DEV] Text: ${template.text.substring(0, 200)}...`);
    return { sent: true };
  }

  try {
    const fromAddr = (EMAIL_FROM.match(/<([^>]+)>/) || [])[1] || EMAIL_FROM.trim();
    const result = await sendViaZoho(host, port, user, password, fromAddr, to, template.subject, template.html, template.text);
    if (!result.ok) {
      console.error('[EMAIL] Send failed:', result.message);
      return { sent: false, error: result.message };
    }
    return { sent: true };
  } catch (err) {
    console.error('[EMAIL] Network error:', err);
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Convenience Functions ───────────────────────────────────────────────────

export async function sendDepositSubmitted(to: string, name: string, amount: string) {
  return sendEmail(to, 'deposit_submitted', { investorName: name, amount });
}

export async function sendDepositApproved(to: string, name: string, amount: string, plan: string) {
  return sendEmail(to, 'deposit_approved', { investorName: name, amount, planName: plan });
}

export async function sendDepositRejected(to: string, name: string, reason: string) {
  return sendEmail(to, 'deposit_rejected', { investorName: name, reason });
}

export async function sendPlanUpdated(to: string, name: string, prevPlan: string, newPlan: string) {
  return sendEmail(to, 'plan_updated', { investorName: name, previousPlan: prevPlan, planName: newPlan });
}

export async function sendRoiPublished(to: string, name: string, roiPercent: string, profit: string) {
  return sendEmail(to, 'roi_published', { investorName: name, roiPercent, profitAmount: profit });
}

export async function sendKycSubmitted(to: string, name: string) {
  return sendEmail(to, 'kyc_submitted', { investorName: name });
}

export async function sendKycApproved(to: string, name: string) {
  return sendEmail(to, 'kyc_approved', { investorName: name });
}

export async function sendKycDeclined(to: string, name: string, reason: string) {
  return sendEmail(to, 'kyc_declined', { investorName: name, reason });
}

export async function sendWithdrawalSubmitted(to: string, name: string, amount: string) {
  return sendEmail(to, 'withdrawal_submitted', { investorName: name, amount });
}

export async function sendWithdrawalApproved(to: string, name: string, amount: string) {
  return sendEmail(to, 'withdrawal_approved', { investorName: name, amount });
}

export async function sendWithdrawalRejected(to: string, name: string, reason: string) {
  return sendEmail(to, 'withdrawal_rejected', { investorName: name, reason });
}

export async function sendSecurityAlert(to: string, name: string, message: string) {
  return sendEmail(to, 'security_alert', { investorName: name, message, eventTime: new Date().toISOString() });
}

export async function sendWelcome(to: string, name: string) {
  return sendEmail(to, 'account_welcome', { investorName: name, message: 'Your account is ready.' });
}

export async function sendReferralReward(to: string, name: string, amount: string) {
  return sendEmail(to, 'referral_reward_credited', { investorName: name, amount });
}
