import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function buffer(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const PRICE_TO_CREDITS: Record<number, { credits: number; fullPass: boolean }> = {
  50: { credits: 1, fullPass: false },
  199: { credits: 5, fullPass: false },
  1499: { credits: 0, fullPass: true },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://faydwdlxexnzvnzcbdrp.supabase.co';

  if (!stripeSecret || !webhookSecret || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const stripe = new Stripe(stripeSecret);
  const sig = req.headers['stripe-signature'] as string;
  const body = await buffer(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const amountTotal = session.amount_total;

    if (!userId || amountTotal == null) {
      console.error('Missing client_reference_id or amount_total');
      return res.status(400).json({ error: 'Missing data' });
    }

    const tier = PRICE_TO_CREDITS[amountTotal];
    if (!tier) {
      console.error('Unknown amount:', amountTotal);
      return res.status(400).json({ error: 'Unknown amount' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (tier.fullPass) {
      const { error } = await adminClient
        .from('user_credits')
        .update({ has_full_pass: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to set full pass:', error);
        return res.status(500).json({ error: 'Failed to update credits' });
      }
    } else {
      const { data: current } = await adminClient
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      const newCredits = (current?.credits ?? 0) + tier.credits;

      const { error } = await adminClient
        .from('user_credits')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to add credits:', error);
        return res.status(500).json({ error: 'Failed to update credits' });
      }
    }

    console.log(`Credited user ${userId}: ${tier.fullPass ? 'full pass' : `+${tier.credits} credits`}`);
  }

  return res.status(200).json({ received: true });
}
