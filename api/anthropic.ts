import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuthOrFreeMatch } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await verifyAuthOrFreeMatch(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { model, system, messages, max_tokens } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'Missing model or messages' });
  }

  const body: Record<string, unknown> = { model, messages, max_tokens: max_tokens ?? 4096 };
  if (system) body.system = system;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      console.error('Anthropic upstream error:', upstream.status);
      return res.status(upstream.status).json({ error: 'Upstream API error' });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Anthropic proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
