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

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { messages, model, search_domain_filter, search_recency_filter, web_search_options } = req.body;

  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const body: Record<string, unknown> = {
    model: model || 'sonar',
    messages,
  };
  if (web_search_options) body.web_search_options = web_search_options;
  if (search_domain_filter) body.search_domain_filter = search_domain_filter;
  if (search_recency_filter) body.search_recency_filter = search_recency_filter;

  try {
    const upstream = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Perplexity upstream error:', upstream.status);
      return res.status(upstream.status).json({ error: 'Upstream API error' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Perplexity proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
