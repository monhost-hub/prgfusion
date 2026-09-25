/**
 * Email service for AllCombiner.
 *
 * Uses Resend (https://resend.com) as the email provider.
 * The API key is read from process.env.RESEND_API_KEY and is NEVER
 * exposed to the browser — this module is server-side only.
 *
 * If RESEND_API_KEY is not set, emails are logged to the console
 * (development mode) and the function returns gracefully. This allows
 * local development without an email provider.
 *
 * SECURITY:
 *   - NEVER import this module from a client component.
 *   - NEVER log the API key, email body tokens, or user passwords.
 *   - The `from` address is hardcoded to noreply@allcombiner.com
 *     (configurable via EMAIL_FROM env var).
 */

import { Resend } from "resend";

const FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@allcombiner.com";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  devMode: boolean;
  error?: string;
}

/**
 * Sends an email via Resend.
 *
 * In development (no RESEND_API_KEY), logs the email to the console
 * instead of sending it — so local dev works without an email provider.
 *
 * Returns true if the email was sent (or logged in dev), false on error.
 * Never throws — the caller decides whether to treat email failure as fatal.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getResend();

  if (!client) {
    // Development mode: log to console instead of sending
    console.log("[email] (dev mode — no RESEND_API_KEY) Email not sent:");
    console.log(`[email]   To: ${params.to}`);
    console.log(`[email]   Subject: ${params.subject}`);
    // Log a truncated version of the body — never log tokens or secrets
    console.log(`[email]   Body: ${params.text?.slice(0, 100) ?? "(HTML only)"}...`);
    return { sent: false, devMode: true, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      console.error("[email] Resend API error:", error.message);
      return { sent: false, devMode: false, error: error.message };
    }

    return { sent: true, devMode: false };
  } catch (err: any) {
    // Log the error type but never the full error (might contain email body)
    console.error("[email] Send failed:", err?.message ?? "unknown error");
    return { sent: false, devMode: false, error: err?.message ?? "unknown error" };
  }
}

/**
 * Generates a verification email in the specified locale.
 * Returns { subject, html, text } ready to be passed to sendEmail().
 *
 * The verification link points to the public AllCombiner domain.
 * The token is included as a query parameter — NEVER log this.
 */
export function buildVerificationEmail(
  locale: string,
  verifyUrl: string
): { subject: string; html: string; text: string } {
  const isFR = locale === "fr";
  const isES = locale === "es";

  const subject = isFR
    ? "Vérifiez votre email — AllCombiner"
    : isES
      ? "Verifica tu correo — AllCombiner"
      : "Verify your email — AllCombiner";

  const title = isFR
    ? "Vérifiez votre adresse email"
    : isES
      ? "Verifica tu dirección de correo"
      : "Verify your email address";

  const body = isFR
    ? "Cliquez sur le bouton ci-dessous pour vérifier votre adresse email et activer pleinement votre compte AllCombiner."
    : isES
      ? "Haz clic en el botón de abajo para verificar tu correo y activar completamente tu cuenta de AllCombiner."
      : "Click the button below to verify your email address and fully activate your AllCombiner account.";

  const buttonText = isFR ? "Vérifier mon email" : isES ? "Verificar mi correo" : "Verify my email";

  const footer = isFR
    ? "Si vous n'avez pas créé de compte AllCombiner, vous pouvez ignorer cet email."
    : isES
      ? "Si no creaste una cuenta de AllCombiner, puedes ignorar este correo."
      : "If you didn't create an AllCombiner account, you can ignore this email.";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #6366f1; font-size: 24px; margin-bottom: 16px;">${title}</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">${body}</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">${buttonText}</a>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 32px; line-height: 1.5;">${footer}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">AllCombiner — Fusion d'images par IA</p>
      </body>
    </html>
  `;

  const text = `${title}\n\n${body}\n\n${verifyUrl}\n\n${footer}\n\nAllCombiner`;

  return { subject, html, text };
}

/**
 * Generates a password reset email in the specified locale.
 * Returns { subject, html, text } ready to be passed to sendEmail().
 *
 * The reset link points to the public AllCombiner reset page with the token
 * as a query parameter — NEVER log this token.
 */
export function buildPasswordResetEmail(
  locale: string,
  resetUrl: string
): { subject: string; html: string; text: string } {
  const isFR = locale === "fr";
  const isES = locale === "es";

  const subject = isFR
    ? "Réinitialisez votre mot de passe — AllCombiner"
    : isES
      ? "Restablece tu contraseña — AllCombiner"
      : "Reset your password — AllCombiner";

  const title = isFR
    ? "Réinitialisez votre mot de passe"
    : isES
      ? "Restablece tu contraseña"
      : "Reset your password";

  const body = isFR
    ? "Vous avez demandé la réinitialisation de votre mot de passe AllCombiner. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure."
    : isES
      ? "Has solicitado restablecer tu contraseña de AllCombiner. Haz clic en el botón de abajo para elegir una nueva contraseña. Este enlace expira en 1 hora."
      : "You requested a password reset for your AllCombiner account. Click the button below to choose a new password. This link expires in 1 hour.";

  const buttonText = isFR
    ? "Réinitialiser mon mot de passe"
    : isES
      ? "Restablecer mi contraseña"
      : "Reset my password";

  const footer = isFR
    ? "Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité."
    : isES
      ? "Si no solicitaste este restablecimiento, puedes ignorar este correo de forma segura."
      : "If you didn't request this reset, you can safely ignore this email.";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #6366f1; font-size: 24px; margin-bottom: 16px;">${title}</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">${body}</p>
        <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">${buttonText}</a>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 32px; line-height: 1.5;">${footer}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">AllCombiner — Fusion d'images par IA</p>
      </body>
    </html>
  `;

  const text = `${title}\n\n${body}\n\n${resetUrl}\n\n${footer}\n\nAllCombiner`;

  return { subject, html, text };
}
