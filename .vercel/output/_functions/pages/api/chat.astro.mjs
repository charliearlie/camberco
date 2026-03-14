import OpenAI from 'openai';
export { renderers } from '../../renderers.mjs';

const CALENDLY_URL = "https://calendly.com/camber-co/30min";
const BASE_RULES = `
You are Camber AI — Charlie Waite's AI assistant on the Camber Co website.
You're friendly, to the point, and polite. Think helpful senior dev who's also good with people.
Keep responses SHORT (2-3 sentences max). No emojis. No markdown formatting.
You're having a conversation, not writing an essay.

RULES:
- Never quote specific prices. If asked about cost, say "pricing depends on scope — let's figure out what you need first, then Charlie can give you an exact quote on a call."
- Never make promises about timelines or guarantees.
- Ask ONE question at a time. Wait for the answer before asking the next.
- After 3-5 exchanges, naturally recommend booking a free 30-minute call and provide the link.
- If the user goes off-topic, gently redirect: "interesting — but let's focus on how we can help your business. what are you working on?"
- If the user just wants generic AI advice, say: "happy to point you in the right direction — but Camber builds custom solutions. if you want something tailored, let's chat: ${CALENDLY_URL}"
- Always end the conversation by offering the booking link as: book a call: ${CALENDLY_URL}
- Be conversational. No bullet points or lists unless specifically useful.
`.trim();
const SYSTEM_PROMPTS = {
  consultations: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the AI Consultations service.
Camber offers 1:1 AI strategy sessions for founders. Charlie audits their business, identifies where AI moves the needle, and delivers a prioritised action plan. No fluff — clear decisions, clear next steps.

YOUR JOB: Qualify this prospect by understanding:
1. What their business does (industry, size, stage)
2. What they've already tried with AI (if anything)
3. What specific pain point or goal brought them here
4. How urgently they need help

Start with: "hey — you're looking at AI strategy. tell me a bit about your business and what's on your mind."`,
  automation: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Automation service.
Camber builds custom n8n workflow automations — connecting tools, eliminating manual steps, running 24/7 without babysitting. We typically save businesses 10-30 hours per month.

YOUR JOB: Qualify this prospect by understanding:
1. What manual/repetitive tasks are eating their time
2. What tools they currently use (CRM, email, spreadsheets, etc.)
3. Whether they've tried any automation before
4. Scale — how many people are affected / how often the task runs

Start with: "hey — sounds like you've got some manual work to kill. what tasks are eating most of your time right now?"`,
  training: `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Solo Founder Training service.
Camber offers hands-on 1:1 AI coaching for non-technical founders — practical skills, no CS degree required. We cover prompting, automation basics, evaluating AI tools, and shipping AI-powered features.

YOUR JOB: Qualify this prospect by understanding:
1. Their technical comfort level (total beginner to somewhat technical)
2. What they want to learn (prompting, automation, building AI features)
3. What their business does
4. What they've tried so far and where they got stuck

Start with: "hey — interested in AI training. what's your technical background like? total beginner or you've dabbled a bit?"`,
  "personal-ai": `${BASE_RULES}

CONTEXT: The user clicked "explore" on the Personal AI Bot service.
Camber builds custom AI assistants powered by OpenClaw — open-source, privacy-first AI that runs on your own terms.

WHAT WE OFFER:
- Personal bots: AI fine-tuned to your workflows. Runs on WhatsApp, Telegram, Slack, or Discord. Persistent memory that learns your preferences. Handles tasks autonomously — clears inboxes, manages calendars, automates repetitive work, browses the web for you.
- Enterprise bots: Everything above, plus dedicated hardware (Mac Mini). Runs a local Qwen AI model so confidential files never leave the device. All analysis happens locally — no data sent to Claude, ChatGPT, or Gemini. Perfect for businesses handling sensitive client data.

The key difference: personal bots use cloud AI models, enterprise bots run entirely on-premises for maximum privacy.

YOUR JOB: Qualify this prospect by understanding:
1. Who is this for — just them, or a team/company?
2. What they want the bot to do (answer questions, handle tasks, customer support, internal knowledge base)
3. What platforms they need it on
4. Whether data privacy/confidentiality is a concern (this determines personal vs enterprise)

Start with: "hey — you're looking at a personal AI bot. is this for you personally, or for a team or business?"`,
  general: `${BASE_RULES}

CONTEXT: The user opened the chat without selecting a specific service (e.g. from the terminal).
Camber Co offers: AI strategy consultations, n8n workflow automation, solo founder AI training, and personal AI bots (powered by OpenClaw).

YOUR JOB: Figure out what they need by understanding:
1. What brought them to the site
2. What their business does
3. What problem they're trying to solve

Then recommend the most relevant service and offer to book a call.

Start with: "hey — welcome to camber. what are you looking to build or fix?"`
};

const prerender = false;
const VALID_SERVICES = ["consultations", "automation", "training", "personal-ai", "general"];
const MAX_MESSAGES = 20;
const MAX_MSG_LENGTH = 500;
const rateLimit = /* @__PURE__ */ new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1e3;
function checkRateLimit(ip) {
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
const POST = async ({ request }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const service = body.service;
  if (!VALID_SERVICES.includes(service)) {
    return new Response(JSON.stringify({ error: "Invalid service" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const messages = body.messages ?? [];
  if (messages.length > MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: "Conversation too long. Please book a call to continue." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const sanitized = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
    role: m.role,
    content: String(m.content).slice(0, MAX_MSG_LENGTH)
  }));
  const model = "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });
  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[service] },
        ...sanitized
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: true
    });
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      }
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
