# AI Enquiry Chatbot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static pricing on service cards and terminal with an interactive AI-powered enquiry chatbot that interviews visitors, qualifies them, recommends the right service, and directs them to Calendly.

**Architecture:** Service cards lose their price tags and gain an "Explore" button that opens a slide-up chat drawer. The drawer contains a terminal-styled chat UI powered by OpenAI's API (proxied through an Astro API route on Vercel). Each service has a tailored system prompt that guides the conversation. The bot qualifies the visitor through 3-5 questions, recommends a service tier, and ends with a Calendly booking link.

**Tech Stack:** Astro 5 (Vercel), OpenAI Chat Completions API (`gpt-4o-mini`), TypeScript, CSS (matching existing terminal aesthetic from `tokens.css`)

---

## Open Questions [NEEDS INPUT]

Before implementation, these need answers from Charlie:

1. **Service lineup** — Are the 4 services (consultations, automation, training, personal AI) still the full list? Or has it been consolidated around the personal AI bot?
2. **Bot tone** — Terminal hacker vibe matching the site? Or more professional/warm?
3. **Qualifying questions** — What do you actually need to know from a prospect to recommend the right service? (e.g., team size, budget range, current tools, technical ability)
4. **Disqualification** — What should the bot do if someone clearly isn't a fit? (e.g., redirect to free resources, still offer Calendly?)
5. **OpenAI API key** — Do you have one? Should we use `OPENAI_API_KEY` env var on Vercel?
6. **Personal AI bot details** — The £500 personal tier: what's included? What platforms? How is it different from the current OpenClaw offering? The £2,000+ enterprise tier: what does the Mac Mini do — local inference? On-prem hosting? What drives the "plus"?
7. **Rate limiting** — Should we limit API calls per visitor? (Recommended: yes, to control costs)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/ChatDrawer.astro` | **New.** Slide-up chat drawer component with terminal-styled UI |
| `src/scripts/chat-drawer.ts` | **New.** Client-side chat logic: open/close drawer, send messages, stream responses, manage conversation state |
| `src/pages/api/chat.ts` | **New.** Astro API route proxying to OpenAI. Accepts `{ service: string, messages: Message[] }`, returns streamed response |
| `src/scripts/chat-prompts.ts` | **New.** System prompts per service, qualifying question templates, Calendly link, conversation rules |
| `src/pages/index.astro` | **Modify.** Remove prices from service cards, change "explore" links to trigger chat drawer, import ChatDrawer component |
| `src/scripts/terminal.ts` | **Modify.** Remove price commands, update `services` command to remove prices, add `explore` command that opens chat drawer |
| `src/pages/index.astro` (CSS) | **Modify.** Remove `.terminal-price` styles, add chat drawer styles |
| `src/pages/index.astro` (schema) | **Modify.** Update FAQ schema to remove specific pricing |
| `astro.config.mjs` | **Modify.** Switch to `output: 'hybrid'` for API route support |
| `.env` | **New.** `OPENAI_API_KEY=sk-...` (not committed) |
| `package.json` | **Modify.** Add `openai` dependency |

---

## Chunk 1: Backend API + Prompts

### Task 1: Add OpenAI dependency, env setup, and Astro hybrid mode

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Modify: `src/pages/index.astro` (add prerender export)
- Modify: `src/pages/about-me.astro` (add prerender export)
- Create: `.env` (gitignored)

- [ ] **Step 1: Install OpenAI SDK**

```bash
pnpm add openai
```

- [ ] **Step 2: Switch Astro to hybrid output mode**

In `astro.config.mjs`, add `output: 'hybrid'` so API routes work as serverless functions while existing pages stay static:

```javascript
export default defineConfig({
  site: 'https://camberco.uk',
  output: 'hybrid',
  integrations: [sitemap()],
  adapter: vercel(),
});
```

- [ ] **Step 3: Add `export const prerender = true` to existing static pages**

Hybrid mode defaults to server-rendering. Existing pages must explicitly opt into static prerendering.

In `src/pages/index.astro`, add after the frontmatter closing `---`:
```typescript
export const prerender = true;
```

In `src/pages/about-me.astro`, add the same export.

**Note:** In Astro, `export const prerender` goes in the component script (frontmatter). For `.astro` files, this means inside the `---` fence.

- [ ] **Step 4: Create .env file**

```
OPENAI_API_KEY=sk-your-key-here
```

- [ ] **Step 5: Verify .gitignore includes .env**

Check `.gitignore` — if `.env` is not listed, add it.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs src/pages/index.astro src/pages/about-me.astro
git commit -m "chore: add openai sdk, switch to hybrid mode for API routes"
```

---

### Task 2: Create system prompts module

**Files:**
- Create: `src/scripts/chat-prompts.ts`

This module exports system prompts per service. Each prompt:
- Establishes the bot as "Camber AI" — Charlie's AI assistant
- Sets the terminal/hacker tone matching the site
- Defines the service context
- Lists 3-5 qualifying questions to ask sequentially
- Includes rules: never reveal pricing, never make promises, always end with Calendly link
- Has a hard guardrail: only discuss Camber Co services, politely deflect off-topic

- [ ] **Step 1: Create the prompts file**

```typescript
// src/scripts/chat-prompts.ts
// System prompts for the AI enquiry chatbot per service category

export const CALENDLY_URL = 'https://calendly.com/camber-co/30min';

const BASE_RULES = `
You are Camber AI — Charlie Waite's AI assistant on the Camber Co website.
You speak in a concise, slightly technical tone — like a senior dev who's also good with people.
Keep responses SHORT (2-3 sentences max). Use lowercase. No emojis.
You're having a conversation, not writing an essay.

RULES:
- Never quote specific prices. If asked about cost, say "pricing depends on scope — let's figure out what you need first, then Charlie can give you an exact quote on a call."
- Never make promises about timelines or guarantees.
- Ask ONE question at a time. Wait for the answer before asking the next.
- After 3-5 exchanges, recommend booking a call and provide the Calendly link.
- If the user goes off-topic, gently redirect: "interesting — but let's focus on how we can help your business. what are you working on?"
- If the user just wants generic AI advice, say: "happy to point you in the right direction — but Camber builds custom solutions. if you want something tailored, let's chat: ${CALENDLY_URL}"
- Always end the conversation by offering the booking link.
- Format the Calendly link as: → book a call: ${CALENDLY_URL}
`.trim();

export type ServiceKey = 'consultations' | 'automation' | 'training' | 'personal-ai' | 'general';

export const SYSTEM_PROMPTS: Record<ServiceKey, string> = {
  consultations: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the AI Consultations service.
Camber offers 1:1 AI strategy sessions for founders. Charlie audits their business, identifies where AI moves the needle, and delivers a prioritised action plan.

YOUR JOB: Qualify this prospect by understanding:
1. What their business does (industry, size, stage)
2. What they've already tried with AI (if anything)
3. What specific pain point or goal brought them here
4. How urgently they need help

Start with: "hey — you're looking at AI strategy. tell me a bit about your business and what's on your mind."`,

  automation: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Automation service.
Camber builds custom n8n workflow automations — connecting tools, eliminating manual steps, running 24/7 without babysitting.

YOUR JOB: Qualify this prospect by understanding:
1. What manual/repetitive tasks are eating their time
2. What tools they currently use (CRM, email, spreadsheets, etc.)
3. Whether they've tried any automation before
4. Scale — how many people are affected / how often the task runs

Start with: "hey — sounds like you've got some manual work to kill. what tasks are eating most of your time right now?"`,

  training: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Solo Founder Training service.
Camber offers hands-on 1:1 AI coaching for non-technical founders — practical skills, no CS degree required.

YOUR JOB: Qualify this prospect by understanding:
1. Their technical comfort level (total beginner → somewhat technical)
2. What they want to learn (prompting, automation, building AI features)
3. What their business does
4. What they've tried so far and where they got stuck

Start with: "hey — interested in AI training. what's your technical background like? total beginner or you've dabbled a bit?"`,

  'personal-ai': `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Personal AI Bot service.
Camber builds custom AI assistants — personal bots (for individuals) and enterprise bots (for teams, includes dedicated hardware). These run on WhatsApp, Telegram, Slack, Discord, or web.

YOUR JOB: Qualify this prospect by understanding:
1. Who is this for — just them, or a team/company?
2. What they want the bot to do (answer questions, handle tasks, customer support, internal knowledge base)
3. What platforms they need it on
4. How much data/context the bot needs to know about

Start with: "hey — you're looking at a personal AI bot. is this for you personally, or for a team/business?"`,

  general: `${BASE_RULES}

CONTEXT: The user opened the chat without selecting a specific service.
Camber Co offers: AI strategy consultations, n8n workflow automation, solo founder training, and personal AI bots.

YOUR JOB: Figure out what they need by understanding:
1. What brought them to the site
2. What their business does
3. What problem they're trying to solve

Then recommend the most relevant service and offer to book a call.

Start with: "hey — welcome to camber. what are you looking to build or fix?"`,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/chat-prompts.ts
git commit -m "feat: add system prompts for AI enquiry chatbot"
```

---

### Task 3: Create API route

**Files:**
- Create: `src/pages/api/chat.ts`

The API route:
- Accepts POST with `{ service: ServiceKey, messages: { role: string, content: string }[] }`
- Validates input (max 20 messages, max 500 chars per message)
- Prepends the appropriate system prompt
- Calls OpenAI Chat Completions (`gpt-4o-mini` for cost efficiency)
- Returns streamed response for real-time typing effect
- Basic rate limiting via simple in-memory counter (resets on cold start — good enough for landing page)

- [ ] **Step 1: Create the API route**

```typescript
// src/pages/api/chat.ts
import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { SYSTEM_PROMPTS, type ServiceKey } from '../../scripts/chat-prompts';

// Opt out of prerendering — this must be a serverless function
export const prerender = false;

const VALID_SERVICES: ServiceKey[] = ['consultations', 'automation', 'training', 'personal-ai', 'general'];
const MAX_MESSAGES = 20;
const MAX_MSG_LENGTH = 500;

// Simple in-memory rate limit (per IP, resets on cold start)
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per window
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

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse and validate
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

  // Sanitize messages
  const sanitized = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, MAX_MSG_LENGTH),
    }));

  const openai = new OpenAI({ apiKey });

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[service] },
        ...sanitized,
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: true,
    });

    // Convert OpenAI stream to ReadableStream
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
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds (API route compiles, OpenAI types resolve).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/chat.ts
git commit -m "feat: add OpenAI chat proxy API route with rate limiting"
```

---

## Chunk 2: Chat Drawer UI Component

### Task 4: Create ChatDrawer Astro component

**Files:**
- Create: `src/components/ChatDrawer.astro`

A slide-up drawer matching the terminal aesthetic. Contains:
- Title bar with service name + close button
- Chat message area (scrollable)
- Text input with send button
- Matches terminal colors from `tokens.css`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/ChatDrawer.astro
// Slide-up chat drawer for AI enquiry conversations
---

<div class="chat-drawer-backdrop" id="chatBackdrop" aria-hidden="true"></div>

<div class="chat-drawer" id="chatDrawer" role="dialog" aria-label="Chat with Camber AI" aria-hidden="true">
  <div class="chat-titlebar">
    <div class="chat-titlebar-left">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green-tc"></span>
      <span class="chat-title" id="chatTitle">camber/ai</span>
    </div>
    <button class="chat-close" id="chatClose" aria-label="Close chat">&times;</button>
  </div>

  <div class="chat-messages" id="chatMessages" role="log" aria-live="polite">
    <!-- Messages rendered here by JS -->
  </div>

  <div class="chat-input-row">
    <span class="chat-prompt" aria-hidden="true">&gt;</span>
    <input
      type="text"
      id="chatInput"
      class="chat-input"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="type your message..."
      aria-label="Chat message input"
    />
    <button class="chat-send" id="chatSend" aria-label="Send message">↵</button>
  </div>
</div>

<style>
  .chat-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .chat-drawer-backdrop[aria-hidden="false"] {
    opacity: 1;
    pointer-events: auto;
  }

  .chat-drawer {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    width: min(480px, calc(100vw - 32px));
    max-height: 70vh;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-00, #0a0a0a);
    border: 1px solid var(--color-border-subtle, #1a1a2e);
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .chat-drawer[aria-hidden="false"] {
    transform: translateX(-50%) translateY(0);
  }

  .chat-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border-subtle, #1a1a2e);
    flex-shrink: 0;
  }

  .chat-titlebar-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chat-title {
    font-size: 0.75rem;
    color: var(--color-text-muted, #8a8a8a);
    margin-left: 8px;
  }

  .chat-close {
    background: none;
    border: none;
    color: var(--color-text-muted, #8a8a8a);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    transition: color 0.15s ease;
  }

  .chat-close:hover {
    color: var(--color-text-primary, #ffffff);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
    max-height: calc(70vh - 110px);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border-subtle, #1a1a2e) transparent;
  }

  .chat-messages::-webkit-scrollbar {
    width: 4px;
  }
  .chat-messages::-webkit-scrollbar-thumb {
    background: var(--color-border-subtle, #1a1a2e);
    border-radius: 2px;
  }

  /* Message bubbles — styled by JS with these classes */
  :global(.chat-msg) {
    font-size: 0.85rem;
    line-height: 1.5;
    padding: 10px 14px;
    border-radius: 8px;
    max-width: 85%;
    animation: chatFadeIn 0.2s ease;
  }

  :global(.chat-msg--bot) {
    background: var(--color-surface-01, #111);
    color: var(--color-text-secondary, #d0d0d0);
    align-self: flex-start;
    border: 1px solid var(--color-border-subtle, #1a1a2e);
  }

  :global(.chat-msg--user) {
    background: var(--color-green-500, #22c55e);
    color: #000;
    align-self: flex-end;
    font-weight: 500;
  }

  :global(.chat-msg--streaming) {
    opacity: 0.9;
  }

  :global(.chat-msg a) {
    color: var(--color-green-400, #4ade80);
    text-decoration: underline;
  }

  :global(.chat-msg--user a) {
    color: #000;
  }

  @keyframes chatFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .chat-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--color-border-subtle, #1a1a2e);
    flex-shrink: 0;
  }

  .chat-prompt {
    color: var(--color-green-500, #22c55e);
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-text-primary, #ffffff);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.85rem;
    caret-color: var(--color-green-500, #22c55e);
  }

  .chat-input::placeholder {
    color: var(--color-text-muted, #8a8a8a);
  }

  .chat-send {
    background: none;
    border: 1px solid var(--color-border-subtle, #1a1a2e);
    color: var(--color-green-500, #22c55e);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.85rem;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .chat-send:hover {
    background: var(--color-green-500, #22c55e);
    color: #000;
  }

  /* Mobile: full width, larger touch targets, prevent iOS zoom */
  @media (max-width: 600px) {
    .chat-drawer {
      width: 100vw;
      max-height: 80vh;
      border-radius: 12px 12px 0 0;
      left: 0;
      transform: translateX(0) translateY(100%);
    }

    .chat-drawer[aria-hidden="false"] {
      transform: translateX(0) translateY(0);
    }

    .chat-input {
      font-size: 16px; /* prevents iOS zoom */
    }

    .chat-messages {
      max-height: calc(80vh - 110px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-drawer {
      transition: none;
    }
    .chat-drawer-backdrop {
      transition: none;
    }
    :global(.chat-msg) {
      animation: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChatDrawer.astro
git commit -m "feat: add ChatDrawer component with terminal-styled UI"
```

---

### Task 5: Create chat drawer client-side logic

**Files:**
- Create: `src/scripts/chat-drawer.ts`

Handles:
- Opening/closing the drawer (with body scroll lock)
- Sending messages to `/api/chat`
- Streaming responses character-by-character into the chat
- Converting Calendly URLs in responses to clickable links
- Managing conversation history (kept client-side)
- Escape key to close

- [ ] **Step 1: Create the script**

```typescript
// src/scripts/chat-drawer.ts
// Client-side logic for the AI enquiry chat drawer

import type { ServiceKey } from './chat-prompts';

declare global {
  interface Window { __openChatDrawer?: (service: ServiceKey) => void; }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let currentService: ServiceKey = 'general';
let messages: Message[] = [];
let isStreaming = false;

function getElements() {
  return {
    drawer: document.getElementById('chatDrawer'),
    backdrop: document.getElementById('chatBackdrop'),
    messagesEl: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput') as HTMLInputElement | null,
    closeBtn: document.getElementById('chatClose'),
    sendBtn: document.getElementById('chatSend'),
    title: document.getElementById('chatTitle'),
  };
}

function linkify(text: string): string {
  // Escape HTML first to prevent XSS from LLM output, then convert URLs to links
  const safe = escapeHtml(text);
  return safe.replace(
    /(https?:\/\/[^\s)&]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

function appendMessage(container: HTMLElement, role: 'user' | 'assistant', content: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'bot'}`;
  div.innerHTML = linkify(content);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function streamResponse(messagesEl: HTMLElement): Promise<void> {
  isStreaming = true;

  // Create placeholder message
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg chat-msg--bot chat-msg--streaming';
  msgEl.textContent = '...';
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: currentService, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      msgEl.classList.remove('chat-msg--streaming');
      msgEl.textContent = err.error || 'Something went wrong. Please try again.';
      isStreaming = false;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      msgEl.textContent = 'Connection error. Please try again.';
      msgEl.classList.remove('chat-msg--streaming');
      isStreaming = false;
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';
    msgEl.textContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      msgEl.innerHTML = linkify(fullText);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    msgEl.classList.remove('chat-msg--streaming');
    messages.push({ role: 'assistant', content: fullText });
  } catch {
    msgEl.classList.remove('chat-msg--streaming');
    msgEl.innerHTML = 'connection lost. <a href="https://calendly.com/camber-co/30min" target="_blank" rel="noopener noreferrer">book a call directly →</a>';
  }

  isStreaming = false;
}

function openDrawer(service: ServiceKey = 'general') {
  const els = getElements();
  if (!els.drawer || !els.backdrop || !els.messagesEl || !els.input || !els.title) return;

  // Reset conversation for new service
  currentService = service;
  messages = [];
  els.messagesEl.innerHTML = '';

  // Set title
  const titles: Record<ServiceKey, string> = {
    consultations: 'camber/ai — consultations',
    automation: 'camber/ai — automation',
    training: 'camber/ai — training',
    'personal-ai': 'camber/ai — personal ai',
    general: 'camber/ai',
  };
  els.title.textContent = titles[service] || 'camber/ai';

  // Show drawer
  els.drawer.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus input
  setTimeout(() => els.input?.focus(), 350);

  // Auto-send empty message to get the bot's opening line
  streamResponse(els.messagesEl);
}

function closeDrawer() {
  const els = getElements();
  if (!els.drawer || !els.backdrop) return;

  els.drawer.setAttribute('aria-hidden', 'true');
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function sendMessage() {
  const els = getElements();
  if (!els.input || !els.messagesEl || isStreaming) return;

  const text = els.input.value.trim();
  if (!text) return;

  els.input.value = '';
  messages.push({ role: 'user', content: text });
  appendMessage(els.messagesEl, 'user', text);
  streamResponse(els.messagesEl);
}

export function initChatDrawer(): void {
  const els = getElements();
  if (!els.drawer) return;

  // Close button
  els.closeBtn?.addEventListener('click', closeDrawer);

  // Backdrop click to close
  els.backdrop?.addEventListener('click', closeDrawer);

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Send button
  els.sendBtn?.addEventListener('click', sendMessage);

  // Enter to send
  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isStreaming) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Expose openDrawer globally so service cards can call it
  window.__openChatDrawer = openDrawer;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/chat-drawer.ts
git commit -m "feat: add chat drawer client-side logic with streaming"
```

---

## Chunk 3: Wire Up UI + Remove Prices

### Task 6: Update service cards — remove prices, wire explore buttons

**Files:**
- Modify: `src/pages/index.astro` (lines ~297-375, ~960-985)

Replace the 4 service card footers: remove `terminal-price`, change `terminal-link` from Calendly direct link to a button that opens the chat drawer with the relevant service context.

- [ ] **Step 1: Update Card 1 (consultations) footer**

Replace:
```html
<div class="terminal-footer">
  <span class="terminal-price">from £297 / session</span>
  <a href="https://calendly.com/camber-co/30min" target="_blank" rel="noopener noreferrer" class="terminal-link">→ explore</a>
</div>
```

With:
```html
<div class="terminal-footer">
  <button class="terminal-link" data-chat-open="consultations">→ explore</button>
</div>
```

- [ ] **Step 2: Update Card 2 (automation) footer** — same pattern, `data-chat-open="automation"`

- [ ] **Step 3: Update Card 3 (training) footer** — same pattern, `data-chat-open="training"`

- [ ] **Step 4: Update Card 4 (openclaw/personal-ai) footer** — same pattern, `data-chat-open="personal-ai"`. Note: the card's terminal title is `camber/openclaw` but the `data-chat-open` attribute must be `personal-ai` to match the `ServiceKey` type in the prompts.

- [ ] **Step 5: Update CSS — remove `.terminal-price`, update `.terminal-link` for button**

Remove:
```css
.terminal-price {
  font-family: var(--font-mono);
  font-size: var(--type-caption);
  color: var(--color-text-muted);
}
```

Update `.terminal-footer` to center-align (since only one element now):
```css
.terminal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-subtle);
}
```

Update `.terminal-link` to work as a button:
```css
.terminal-link {
  font-family: var(--font-mono);
  font-size: var(--type-caption);
  color: var(--color-green-500);
  text-decoration: none;
  background: none;
  border: 1px solid var(--color-green-500);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--duration-quick) var(--easing-smooth);
}

.terminal-link:hover {
  background: var(--color-green-500);
  color: #000;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: remove prices from service cards, wire explore to chat drawer"
```

---

### Task 7: Import ChatDrawer and wire everything up

**Files:**
- Modify: `src/pages/index.astro` (imports + script block)

- [ ] **Step 1: Add ChatDrawer component import and placement**

In the frontmatter, add:
```typescript
import ChatDrawer from '../components/ChatDrawer.astro';
```

Place `<ChatDrawer />` just before `</Layout>` (after the `final-cta` section, before the closing tag).

- [ ] **Step 2: Add chat drawer script init**

In the `<script>` block, add:
```typescript
import { initChatDrawer } from '../scripts/chat-drawer';
initChatDrawer();
```

- [ ] **Step 3: Add click handlers for data-chat-open buttons**

In the `<script>` block, after `initChatDrawer()`:
```typescript
// Wire up "explore" buttons on service cards
document.querySelectorAll('[data-chat-open]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const service = (btn as HTMLElement).dataset.chatOpen;
    if (service && window.__openChatDrawer) {
      window.__openChatDrawer(service);
    }
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/components/ChatDrawer.astro
git commit -m "feat: integrate ChatDrawer into index page"
```

---

### Task 8: Update terminal commands — remove prices, add explore command

**Files:**
- Modify: `src/scripts/terminal.ts`

- [ ] **Step 1: Update `services` command — remove prices**

Replace the services command output with:
```typescript
services: {
  description: 'list services',
  run: () => L`
  <span class="t-green">ACTIVE SERVICES</span>

    <span class="t-green">  consultations</span>   AI strategy sessions
    <span class="t-green">  automation</span>      n8n workflow engineering
    <span class="t-green">  training</span>        solo founder coaching
    <span class="t-green">  personal-ai</span>     your own AI assistant

  <span class="t-muted">click "→ explore" on any service card above, or type "book"</span>
  `,
},
```

- [ ] **Step 2: Replace `price` command with `explore` command**

Remove the entire `price` command. Add:
```typescript
explore: {
  description: 'explore services',
  run: (args) => {
    const service = args[0] || '';
    const valid = ['consultations', 'automation', 'training', 'personal-ai'];
    if (valid.includes(service)) {
      // Open chat drawer from terminal
      setTimeout(() => {
        if (window.__openChatDrawer) {
          window.__openChatDrawer(service);
        }
      }, 100);
      return [`<span class="t-green">opening chat...</span>`];
    }
    return [
      '<span class="t-muted">usage:</span> explore <span class="t-green">consultations</span> | <span class="t-green">automation</span> | <span class="t-green">training</span> | <span class="t-green">personal-ai</span>',
    ];
  },
},
```

- [ ] **Step 3: Update `help` command — replace price with explore**

Update the help output to show `explore` instead of `price`:
```
<span class="t-green">explore</span> <span class="t-muted">--flag</span>    chat with AI about a service
```

- [ ] **Step 4: Update PUBLIC_COMMANDS and ALL_COMPLETIONS**

Replace `price` entries:
```typescript
const PUBLIC_COMMANDS = [
  'help', 'status', 'about', 'services',
  'explore consultations', 'explore automation', 'explore training', 'explore personal-ai',
  'stack', 'contact', 'book', 'clear',
];
```

Remove `price` from ALL_COMPLETIONS, add `explore`.

- [ ] **Step 5: Update contact/book commands — remove price references**

In the `book` command output, ensure no pricing is mentioned (currently clean — just verify).

- [ ] **Step 6: Commit**

```bash
git add src/scripts/terminal.ts
git commit -m "feat: replace price commands with explore, remove pricing from terminal"
```

---

## Chunk 4: Content Cleanup + Polish

### Task 9: Update FAQ and schema — remove specific prices

**Files:**
- Modify: `src/pages/index.astro` (FAQ section + schema JSON)

- [ ] **Step 1: Update FAQ answer for "How much does AI consultancy cost in the UK?"**

Replace the answer at ~line 484 with something like:
```html
<p>Pricing depends on what you need — every business is different. At Camber Co, every engagement starts with a free 30-minute audit call where we understand your situation and recommend the right approach. Click "explore" on any service to chat with our AI and get a personalised recommendation, or book a call directly.</p>
```

- [ ] **Step 2: Update schema JSON FAQ answer for the same question**

At ~line 166, update the `text` field to match the new FAQ answer (without HTML).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: update FAQ to remove specific prices, point to explore flow"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 2: Run dev server and test**

```bash
pnpm dev
```

Test checklist:
- Service cards show "→ explore" button (no prices)
- Clicking "→ explore" opens chat drawer
- Chat drawer slides up with correct service title
- Bot sends opening message automatically
- User can type and send messages
- Responses stream in character-by-character
- Calendly links in bot responses are clickable
- Escape / backdrop click closes drawer
- Body scroll is locked when drawer is open
- Terminal `services` command shows no prices
- Terminal `explore consultations` opens chat drawer
- Terminal `price` command no longer exists
- FAQ no longer shows specific prices
- Mobile: drawer is full-width, input doesn't trigger iOS zoom
- Reduced motion: no animations

- [ ] **Step 3: Commit any fixes from testing**

- [ ] **Step 4: Final commit if all clean**

```bash
git add -A
git commit -m "feat: complete AI enquiry chatbot — removes pricing, adds interactive explore flow"
```
