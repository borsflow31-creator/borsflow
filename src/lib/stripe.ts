import Stripe from 'stripe';
import { decrypt } from '@/lib/encryption';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
    });
  }
  return _stripe;
}

// Keep backward-compatible named export for existing usages
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

/**
 * Returns a Stripe client for a given workspace using its direct API keys.
 * Falls back to the platform-level client if no workspace keys are configured.
 */
export async function getStripeForWorkspace(
  workspace: { stripeSecretKey?: string | null }
): Promise<Stripe> {
  if (workspace.stripeSecretKey) {
    try {
      const secretKey = decrypt(workspace.stripeSecretKey);
      return new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
    } catch {
      // Fall through to platform client on decryption failure
    }
  }
  return getStripe();
}

// Platform fee percentage (0 = no fee). Set PLATFORM_FEE_PERCENT in env to enable.
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0');

function computeApplicationFee(amountCents: number): number {
  if (PLATFORM_FEE_PERCENT <= 0) return 0;
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

// ─── Stripe Connect ──────────────────────────────────────────────────────────

/**
 * Creates a Stripe Express account for a new connected user.
 */
export async function createConnectAccount(email: string): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  return account.id;
}

/**
 * Generates an onboarding link for a connected account.
 * The user visits this URL to complete Stripe onboarding.
 */
export async function createAccountLink(
  accountId: string,
  workspaceId: string
): Promise<string> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/settings?section=integrations&stripe=refresh&workspaceId=${workspaceId}`,
    return_url: `${baseUrl}/settings?section=integrations&stripe=success&workspaceId=${workspaceId}`,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Returns whether the connected account has charges enabled.
 */
export async function getAccountStatus(
  accountId: string
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

/**
 * Creates a Stripe Login Link for the connected account dashboard.
 */
export async function createLoginLink(accountId: string): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Gets or creates a Stripe Customer.
 * Accepts an optional stripeClient to use workspace-level keys.
 */
export async function getOrCreateCustomer(
  connectedAccountId: string,
  email: string,
  name: string,
  stripeClient?: Stripe
): Promise<string> {
  const client = stripeClient || getStripe();
  const opts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined;

  const existing = await client.customers.list({ email, limit: 1 }, opts as any);
  if (existing.data.length > 0) return existing.data[0].id;

  const customer = await client.customers.create({ email, name }, opts as any);
  return customer.id;
}

// ─── Payment Links ────────────────────────────────────────────────────────────

export interface CreatePaymentLinkParams {
  connectedAccountId?: string;
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;   // total in cents
  currency: string;
  clientEmail?: string;
  description?: string;
  stripeClient?: Stripe; // pass workspace-level client for direct keys
}

/**
 * Creates a Stripe Payment Link.
 * Supports both Connect (connectedAccountId) and direct key (stripeClient) modes.
 */
export async function createInvoicePaymentLink(
  params: CreatePaymentLinkParams
): Promise<{ url: string; paymentLinkId: string }> {
  const { connectedAccountId, invoiceId, invoiceNumber, amountCents, currency, description, stripeClient } = params;

  const client = stripeClient || getStripe();
  const stripeAccountOpts = (!stripeClient && connectedAccountId)
    ? { stripeAccount: connectedAccountId }
    : undefined;

  // Create a one-time price
  const price = await client.prices.create(
    {
      currency: currency.toLowerCase(),
      unit_amount: amountCents,
      product_data: {
        name: `Invoice ${invoiceNumber}`,
        metadata: { invoiceId },
      },
    },
    stripeAccountOpts as any
  );

  const applicationFeeAmount = (!stripeClient && connectedAccountId)
    ? computeApplicationFee(amountCents)
    : 0;

  const linkData: Stripe.PaymentLinkCreateParams = {
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { invoiceId },
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message: description || `Thank you for your payment for ${invoiceNumber}.`,
      },
    },
  };

  if (applicationFeeAmount > 0) {
    linkData.application_fee_amount = applicationFeeAmount;
  }

  const paymentLink = await client.paymentLinks.create(linkData, stripeAccountOpts as any);

  return { url: paymentLink.url, paymentLinkId: paymentLink.id };
}

/**
 * Deactivates a Stripe Payment Link (e.g. when invoice is cancelled).
 * Supports both Connect and direct key modes.
 */
export async function deactivatePaymentLink(
  connectedAccountId: string,
  paymentLinkId: string,
  stripeClient?: Stripe
): Promise<void> {
  const client = stripeClient || getStripe();
  const opts = (!stripeClient && connectedAccountId)
    ? { stripeAccount: connectedAccountId }
    : undefined;
  await client.paymentLinks.update(paymentLinkId, { active: false }, opts as any);
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/**
 * Verifies and constructs a Stripe webhook event.
 */
export function constructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
