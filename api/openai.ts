import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import { verifyAuthOrFreeMatch } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await verifyAuthOrFreeMatch(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { model, messages, response_format, temperature, stream, tools, tool_choice } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'Missing model or messages' });
  }

  const body: Record<string, unknown> = { model, messages };
  if (response_format) body.response_format = response_format;
  if (temperature !== undefined) body.temperature = temperature;
  if (stream) body.stream = true;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      console.error('OpenAI upstream error:', upstream.status);
      return res.status(upstream.status).json({ error: 'Upstream API error' });
    }

    if (stream && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body.getReader();
      const nodeStream = new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) { this.push(null); return; }
          this.push(Buffer.from(value));
        },
      });
      nodeStream.pipe(res);
      return;
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('OpenAI proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
