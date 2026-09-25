/**
 * Transactional email templates for AllCombiner.
 *
 * This module provides typed, localized email templates for all transactional
 * emails sent by the application. Each template:
 *   - Accepts strongly-typed data (no `any`)
 *   - Returns { subject, html, text } compatible with sendEmail()
 *   - Supports FR / EN / ES
 *   - Uses a shared HTML wrapper for consistent branding
 *
 * Templates are NOT triggered here — this file only defines the templates.
 * Triggering logic (crons, webhooks, events) will be added in future phases.
 *
 * USAGE:
 *   import { buildWelcomeEmail, buildCreditPurchaseEmail } from "@/lib/email-templates";
 *   const content = buildWelcomeEmail("fr", { userName: "Alice" });
 *   await sendEmail({ to: user.email, ...content });
 */

// ============================================================================
// TYPES — strongly-typed data for each template
// ============================================================================

export interface WelcomeEmailData {
  userName: string;
}

export interface CreditPurchaseEmailData {
  userName: string;
  credits: number;
  amount: number;
  currency: string;
  /** "recharge_normal" | "recharge_subscriber" | "subscription" | "test_1dollar" */
  creditType: string;
  /** null = no expiration, Date = expires at this date */
  expiresAt: Date | null;
}

export interface SubscriptionActivatedEmailData {
  userName: string;
  plan: string;
  credits: number;
  startDate: Date;
  endDate: Date;
  renewalPrice: number;
  currency: string;
  /** true = will auto-renew, false = will expire */
  autoRenew: boolean;
}

export interface LowCreditsEmailData {
  userName: string;
  currentCredits: number;
  /** threshold that triggered the alert (e.g. 5) */
  threshold: number;
}

export interface SubscriptionReminderEmailData {
  userName: string;
  plan: string;
  /** days until expiration (1 or 3) */
  daysRemaining: number;
  endDate: Date;
  renewalPrice: number;
  currency: string;
}

export interface SubscriptionExpiredEmailData {
  userName: string;
  plan: string;
  expiredAt: Date;
}

export interface PostExpirationFollowUpEmailData {
  userName: string;
  daysSinceExpiration: number;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

type Locale = "fr" | "en" | "es";

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function normalizeLocale(locale: string): Locale {
  if (locale?.startsWith("es")) return "es";
  if (locale?.startsWith("en")) return "en";
  return "fr";
}

function formatDate(date: Date, locale: Locale): string {
  const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
  const lang = locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US";
  return new Intl.DateTimeFormat(lang, opts).format(date);
}

function formatPrice(amount: number, currency: string): string {
  const symbol = currency.toUpperCase() === "EUR" ? "€" : currency.toUpperCase() === "USD" ? "$" : currency;
  return `${amount.toFixed(2)} ${symbol}`;
}

function formatExpiration(expiresAt: Date | null, locale: Locale): string {
  if (!expiresAt) {
    return locale === "fr" ? "Sans expiration" : locale === "es" ? "Sin caducidad" : "No expiration";
  }
  const formatted = formatDate(expiresAt, locale);
  return locale === "fr"
    ? `Expire le ${formatted}`
    : locale === "es"
      ? `Caduca el ${formatted}`
      : `Expires on ${formatted}`;
}

/**
 * Shared HTML wrapper — consistent branding for all emails.
 */
function wrapHtml(title: string, bodyHtml: string, locale: Locale): string {
  const footerText = locale === "fr"
    ? "Cet email a été envoyé automatiquement. Merci de ne pas répondre."
    : locale === "es"
      ? "Este correo fue enviado automáticamente. Por favor no respondas."
      : "This email was sent automatically. Please do not reply.";

  const supportText = locale === "fr"
    ? "Besoin d'aide ? Contactez-nous à support@allcombiner.com"
    : locale === "es"
      ? "¿Necesitas ayuda? Contáctanos en support@allcombiner.com"
      : "Need help? Contact us at support@allcombiner.com";

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #6366f1; font-size: 24px; margin-bottom: 16px;">${title}</h1>
        ${bodyHtml}
        <p style="color: #9ca3af; font-size: 13px; margin-top: 32px; line-height: 1.5;">${footerText}</p>
        <p style="color: #9ca3af; font-size: 12px;">${supportText}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">AllCombiner — ${locale === "fr" ? "Fusion d'images par IA" : locale === "es" ? "Fusión de imágenes por IA" : "AI Image Fusion"}</p>
      </body>
    </html>
  `;
}

function buildTextVersion(title: string, bodyText: string, locale: Locale): string {
  const footer = locale === "fr"
    ? "Cet email a été envoyé automatiquement. Merci de ne pas répondre."
    : locale === "es"
      ? "Este correo fue enviado automáticamente. Por favor no respondas."
      : "This email was sent automatically. Please do not reply.";
  const support = "support@allcombiner.com";
  return `${title}\n\n${bodyText}\n\n${footer}\n${support}\n\nAllCombiner`;
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * 1. Welcome — sent after registration (after email verification).
 */
export function buildWelcomeEmail(localeRaw: string, data: WelcomeEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? "Bienvenue sur AllCombiner !"
    : locale === "es"
      ? "¡Bienvenido a AllCombiner!"
      : "Welcome to AllCombiner!";

  const title = subject;
  const name = data.userName || (locale === "fr" ? "cher utilisateur" : locale === "es" ? "querido usuario" : "dear user");

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Votre compte AllCombiner est prêt ! Vous disposez de 3 crédits gratuits pour découvrir notre service de fusion d'images par IA.</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Lancez votre première fusion dès maintenant :</p>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">¡Tu cuenta de AllCombiner está lista! Tienes 3 créditos gratis para descubrir nuestro servicio de fusión de imágenes con IA.</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Inicia tu primera fusión ahora:</p>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Your AllCombiner account is ready! You have 3 free credits to discover our AI image fusion service.</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Start your first fusion now:</p>`;

  const ctaText = locale === "fr" ? "Fusionner mes images" : locale === "es" ? "Fusionar mis imágenes" : "Fuse my images";
  const ctaHtml = `<a href="https://allcombiner.com/${locale}/fusion" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">${ctaText}</a>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nVotre compte AllCombiner est prêt ! Vous disposez de 3 crédits gratuits.\n\nLancez votre première fusion : https://allcombiner.com/${locale}/fusion`
    : locale === "es"
      ? `Hola ${name},\n\n¡Tu cuenta de AllCombiner está lista! Tienes 3 créditos gratis.\n\nInicia tu primera fusión: https://allcombiner.com/${locale}/fusion`
      : `Hello ${name},\n\nYour AllCombiner account is ready! You have 3 free credits.\n\nStart your first fusion: https://allcombiner.com/${locale}/fusion`;

  return {
    subject,
    html: wrapHtml(title, body + ctaHtml, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 2. Credit purchase — sent after a successful recharge or credit purchase.
 */
export function buildCreditPurchaseEmail(localeRaw: string, data: CreditPurchaseEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? `Achat confirmé — ${data.credits} crédits ajoutés`
    : locale === "es"
      ? `Compra confirmada — ${data.credits} créditos añadidos`
      : `Purchase confirmed — ${data.credits} credits added`;

  const title = subject;
  const name = data.userName || "";

  const expirationText = formatExpiration(data.expiresAt, locale);
  const priceText = formatPrice(data.amount, data.currency);

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Votre achat a été confirmé :</p>
       <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Crédits</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Montant</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${priceText}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.creditType}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Expiration</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${expirationText}</td></tr>
       </table>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Tu compra ha sido confirmada:</p>
         <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Créditos</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Monto</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${priceText}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tipo</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.creditType}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Caducidad</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${expirationText}</td></tr>
         </table>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Your purchase has been confirmed:</p>
         <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Credits</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${priceText}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.creditType}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Expiration</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${expirationText}</td></tr>
         </table>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nAchat confirmé :\nCrédits: ${data.credits}\nMontant: ${priceText}\nType: ${data.creditType}\nExpiration: ${expirationText}`
    : locale === "es"
      ? `Hola ${name},\n\nCompra confirmada:\nCréditos: ${data.credits}\nMonto: ${priceText}\nTipo: ${data.creditType}\nCaducidad: ${expirationText}`
      : `Hello ${name},\n\nPurchase confirmed:\nCredits: ${data.credits}\nAmount: ${priceText}\nType: ${data.creditType}\nExpiration: ${expirationText}`;

  return {
    subject,
    html: wrapHtml(title, body, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 3. Subscription activated — sent after a subscription starts or renews.
 */
export function buildSubscriptionActivatedEmail(localeRaw: string, data: SubscriptionActivatedEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? `Abonnement ${data.plan} activé`
    : locale === "es"
      ? `Suscripción ${data.plan} activada`
      : `Subscription ${data.plan} activated`;

  const title = subject;
  const name = data.userName || "";
  const startStr = formatDate(data.startDate, locale);
  const endStr = formatDate(data.endDate, locale);
  const priceText = formatPrice(data.renewalPrice, data.currency);

  const renewalText = data.autoRenew
    ? (locale === "fr" ? `Renouvellement automatique le ${endStr} (${priceText}/mois)` : locale === "es" ? `Renovación automática el ${endStr} (${priceText}/mes)` : `Auto-renewal on ${endStr} (${priceText}/month)`)
    : (locale === "fr" ? `Expire le ${endStr} (sans renouvellement automatique)` : locale === "es" ? `Caduca el ${endStr} (sin renovación automática)` : `Expires on ${endStr} (no auto-renewal)`);

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Votre abonnement <strong>${data.plan}</strong> est actif.</p>
       <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Plan</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.plan}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Crédits/mois</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Début</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${startStr}</td></tr>
         <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Renouvellement</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${renewalText}</td></tr>
       </table>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Tu suscripción <strong>${data.plan}</strong> está activa.</p>
         <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Plan</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.plan}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Créditos/mes</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Inicio</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${startStr}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Renovación</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${renewalText}</td></tr>
         </table>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Your <strong>${data.plan}</strong> subscription is active.</p>
         <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Plan</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.plan}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Credits/month</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.credits}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Start</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${startStr}</td></tr>
           <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Renewal</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${renewalText}</td></tr>
         </table>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nAbonnement ${data.plan} activé.\nCrédits/mois: ${data.credits}\nDébut: ${startStr}\n${renewalText}`
    : locale === "es"
      ? `Hola ${name},\n\nSuscripción ${data.plan} activada.\nCréditos/mes: ${data.credits}\nInicio: ${startStr}\n${renewalText}`
      : `Hello ${name},\n\nSubscription ${data.plan} activated.\nCredits/month: ${data.credits}\nStart: ${startStr}\n${renewalText}`;

  return {
    subject,
    html: wrapHtml(title, body, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 4. Low credits — sent when balance drops below threshold.
 */
export function buildLowCreditsEmail(localeRaw: string, data: LowCreditsEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? `Solde de crédits faible — ${data.currentCredits} restants`
    : locale === "es"
      ? `Saldo de créditos bajo — ${data.currentCredits} restantes`
      : `Low credits balance — ${data.currentCredits} remaining`;

  const title = subject;
  const name = data.userName || "";

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Il vous reste seulement <strong style="color: #f59e0b;">${data.currentCredits} crédits</strong> sur votre compte AllCombiner.</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Rechargez votre compte pour continuer à fusionner vos images :</p>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Te quedan solo <strong style="color: #f59e0b;">${data.currentCredits} créditos</strong> en tu cuenta de AllCombiner.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Recarga tu cuenta para seguir fusionando tus imágenes:</p>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">You only have <strong style="color: #f59e0b;">${data.currentCredits} credits</strong> left on your AllCombiner account.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Recharge your account to keep fusing your images:</p>`;

  const ctaText = locale === "fr" ? "Recharger mes crédits" : locale === "es" ? "Recargar mis créditos" : "Recharge credits";
  const ctaHtml = `<a href="https://allcombiner.com/${locale}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">${ctaText}</a>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nIl vous reste ${data.currentCredits} crédits.\n\nRechargez: https://allcombiner.com/${locale}/pricing`
    : locale === "es"
      ? `Hola ${name},\n\nTe quedan ${data.currentCredits} créditos.\n\nRecarga: https://allcombiner.com/${locale}/pricing`
      : `Hello ${name},\n\nYou have ${data.currentCredits} credits left.\n\nRecharge: https://allcombiner.com/${locale}/pricing`;

  return {
    subject,
    html: wrapHtml(title, body + ctaHtml, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 5. Subscription reminder — sent 3 days or 1 day before expiration.
 */
export function buildSubscriptionReminderEmail(localeRaw: string, data: SubscriptionReminderEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? `Votre abonnement ${data.plan} expire dans ${data.daysRemaining} jour${data.daysRemaining > 1 ? "s" : ""}`
    : locale === "es"
      ? `Tu suscripción ${data.plan} expira en ${data.daysRemaining} día${data.daysRemaining > 1 ? "s" : ""}`
      : `Your ${data.plan} subscription expires in ${data.daysRemaining} day${data.daysRemaining > 1 ? "s" : ""}`;

  const title = subject;
  const name = data.userName || "";
  const endStr = formatDate(data.endDate, locale);
  const priceText = formatPrice(data.renewalPrice, data.currency);

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Votre abonnement <strong>${data.plan}</strong> expire le <strong>${endStr}</strong>.</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Pour continuer à profiter de vos crédits et de la réduction de 25% sur les recharges, renouvelez votre abonnement :</p>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Tu suscripción <strong>${data.plan}</strong> expira el <strong>${endStr}</strong>.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Para seguir disfrutando de tus créditos y del 25% de descuento en recargas, renueva tu suscripción:</p>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Your <strong>${data.plan}</strong> subscription expires on <strong>${endStr}</strong>.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">To keep enjoying your credits and the 25% discount on recharges, renew your subscription:</p>`;

  const ctaText = locale === "fr" ? "Renouveler mon abonnement" : locale === "es" ? "Renovar mi suscripción" : "Renew my subscription";
  const ctaHtml = `<a href="https://allcombiner.com/${locale}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">${ctaText}</a>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nVotre abonnement ${data.plan} expire le ${endStr}.\n\nRenouvelez: https://allcombiner.com/${locale}/pricing`
    : locale === "es"
      ? `Hola ${name},\n\nTu suscripción ${data.plan} expira el ${endStr}.\n\nRenueva: https://allcombiner.com/${locale}/pricing`
      : `Hello ${name},\n\nYour ${data.plan} subscription expires on ${endStr}.\n\nRenew: https://allcombiner.com/${locale}/pricing`;

  return {
    subject,
    html: wrapHtml(title, body + ctaHtml, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 6. Subscription expired — sent when the subscription has expired.
 */
export function buildSubscriptionExpiredEmail(localeRaw: string, data: SubscriptionExpiredEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? `Votre abonnement ${data.plan} a expiré`
    : locale === "es"
      ? `Tu suscripción ${data.plan} ha expirado`
      : `Your ${data.plan} subscription has expired`;

  const title = subject;
  const name = data.userName || "";
  const expiredStr = formatDate(data.expiredAt, locale);

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Votre abonnement <strong>${data.plan}</strong> a expiré le ${expiredStr}.</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Vous ne bénéficiez plus de la réduction de 25% sur les recharges. Pour la retrouver, renouvelez votre abonnement :</p>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Tu suscripción <strong>${data.plan}</strong> expiró el ${expiredStr}.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Ya no tienes el 25% de descuento en recargas. Para recuperarlo, renueva tu suscripción:</p>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Your <strong>${data.plan}</strong> subscription expired on ${expiredStr}.</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">You no longer get the 25% discount on recharges. To get it back, renew your subscription:</p>`;

  const ctaText = locale === "fr" ? "Renouveler mon abonnement" : locale === "es" ? "Renovar mi suscripción" : "Renew my subscription";
  const ctaHtml = `<a href="https://allcombiner.com/${locale}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">${ctaText}</a>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nVotre abonnement ${data.plan} a expiré le ${expiredStr}.\n\nRenouvelez: https://allcombiner.com/${locale}/pricing`
    : locale === "es"
      ? `Hola ${name},\n\nTu suscripción ${data.plan} expiró el ${expiredStr}.\n\nRenueva: https://allcombiner.com/${locale}/pricing`
      : `Hello ${name},\n\nYour ${data.plan} subscription expired on ${expiredStr}.\n\nRenew: https://allcombiner.com/${locale}/pricing`;

  return {
    subject,
    html: wrapHtml(title, body + ctaHtml, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}

/**
 * 7. Post-expiration follow-up — sent N days after expiration to win back the user.
 */
export function buildPostExpirationFollowUpEmail(localeRaw: string, data: PostExpirationFollowUpEmailData): EmailContent {
  const locale = normalizeLocale(localeRaw);

  const subject = locale === "fr"
    ? "On vous manque sur AllCombiner"
    : locale === "es"
      ? "Te extrañamos en AllCombiner"
      : "We miss you on AllCombiner";

  const title = subject;
  const name = data.userName || "";

  const body = locale === "fr"
    ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bonjour ${name},</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Cela fait ${data.daysSinceExpiration} jours que votre abonnement a expiré. Vos crédits sans expiration sont toujours disponibles !</p>
       <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Revenez profiter de la réduction de 25% sur les recharges avec un abonnement :</p>`
    : locale === "es"
      ? `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hola ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Han pasado ${data.daysSinceExpiration} días desde que expiró tu suscripción. ¡Tus créditos sin caducidad siguen disponibles!</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Vuelve a disfrutar del 25% de descuento en recargas con una suscripción:</p>`
      : `<p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello ${name},</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">It's been ${data.daysSinceExpiration} days since your subscription expired. Your non-expiring credits are still available!</p>
         <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 16px;">Come back and enjoy 25% off recharges with a subscription:</p>`;

  const ctaText = locale === "fr" ? "Découvrir les abonnements" : locale === "es" ? "Ver suscripciones" : "See subscriptions";
  const ctaHtml = `<a href="https://allcombiner.com/${locale}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">${ctaText}</a>`;

  const bodyText = locale === "fr"
    ? `Bonjour ${name},\n\nCela fait ${data.daysSinceExpiration} jours que votre abonnement a expiré.\n\nDécouvrir: https://allcombiner.com/${locale}/pricing`
    : locale === "es"
      ? `Hola ${name},\n\nHan pasado ${data.daysSinceExpiration} días desde que expiró tu suscripción.\n\nVer: https://allcombiner.com/${locale}/pricing`
      : `Hello ${name},\n\nIt's been ${data.daysSinceExpiration} days since your subscription expired.\n\nSee: https://allcombiner.com/${locale}/pricing`;

  return {
    subject,
    html: wrapHtml(title, body + ctaHtml, locale),
    text: buildTextVersion(title, bodyText, locale),
  };
}
