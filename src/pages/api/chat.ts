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

const ENQUIRY_TOOL: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'submit_enquiry',
    description: 'Submit an enquiry on behalf of the prospect once you have their name, email, and understand what they need.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The prospect's full name" },
        email: { type: 'string', description: "The prospect's email address" },
        company: { type: 'string', description: "The prospect's company name (if mentioned)" },
        service: { type: 'string', description: 'The service they are interested in (AI Strategy, Automation, Training, Personal AI, or Something else)' },
        message: { type: 'string', description: 'A brief summary of what the prospect needs, based on the conversation' },
      },
      required: ['name', 'email', 'service', 'message'],
    },
  },
};

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
    return new Response(JSON.stringify({ error: 'Conversation too long. Please submit an enquiry to continue.' }), {
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
    // First, make a non-streaming call to check for tool calls
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[service] },
        ...sanitized,
      ],
      max_tokens: 200,
      temperature: 0.7,
      tools: [ENQUIRY_TOOL],
    });

    const choice = completion.choices[0];

    // Handle tool call
    if (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === 'submit_enquiry') {
        let args: { name: string; email: string; company?: string; service: string; message: string };
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          return textResponse('sorry, something went wrong submitting your enquiry. could you try the contact form at /contact instead?');
        }

        // Submit enquiry internally
        const { createClient } = await import('@supabase/supabase-js');
        const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
        const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

        const { error } = await supabase.from('enquiries').insert({
          name: args.name,
          email: args.email,
          company: args.company || null,
          service: args.service,
          message: args.message,
          source: 'bot',
          chat_transcript: sanitized,
        });

        if (error) {
          console.error('Enquiry insert from bot failed:', error);
          return textResponse('sorry, there was an issue submitting your enquiry. you can also reach us at /contact — Charlie will get back to you.');
        }

        // Send emails (non-blocking)
        import('../../lib/email').then(({ sendAdminNotification, sendSenderConfirmation }) => {
          const data = { name: args.name, email: args.email, company: args.company, service: args.service, message: args.message, source: 'bot' as const };
          sendAdminNotification(data).catch((e) => console.error('Admin email failed:', e));
          sendSenderConfirmation(data).catch((e) => console.error('Confirmation email failed:', e));
        });

        // Get a follow-up response from the model
        const followUp = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPTS[service] },
            ...sanitized,
            choice.message as OpenAI.ChatCompletionMessageParam,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Enquiry submitted successfully for ${args.name} (${args.email}). Charlie will review it and get back to them.`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        });

        const followUpText = followUp.choices[0]?.message?.content ?? "done — I've sent that through. Charlie will be in touch shortly.";
        return textResponse(followUpText);
      }
    }

    // Normal text response (no tool call) — stream it
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[service] },
        ...sanitized,
      ],
      max_tokens: 200,
      temperature: 0.7,
      tools: [ENQUIRY_TOOL],
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

function textResponse(text: string): Response {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
