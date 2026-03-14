import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { SYSTEM_PROMPTS, type ServiceKey } from '../../scripts/chat-prompts';

export const prerender = false;

const VALID_SERVICES: ServiceKey[] = ['consultations', 'automation', 'training', 'personal-ai', 'general'];
const MAX_MESSAGES = 20;
const MAX_MSG_LENGTH = 500;

// In-memory rate limit (cost protection — resets on cold start)
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { service?: string; messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const service = body.service as ServiceKey;
  if (!VALID_SERVICES.includes(service)) {
    return new Response(JSON.stringify({ error: 'Invalid service' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = body.messages ?? [];
  if (messages.length > MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Conversation too long. Please book a call to continue.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sanitized = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, MAX_MSG_LENGTH),
    }));

  const model = import.meta.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openai = new OpenAI({ apiKey });

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[service] },
        ...sanitized,
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('OpenAI error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
