// src/scripts/chat-drawer.ts
// Client-side logic for the AI enquiry chat drawer

import type { ServiceKey } from './chat-prompts';

declare global {
  interface Window {
    __openChatDrawer?: (service: ServiceKey) => void;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkify(text: string): string {
  const safe = escapeHtml(text);
  return safe.replace(
    /(https?:\/\/[^\s)&]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
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
    msgEl.innerHTML =
      'connection lost. <a href="/contact/">get in touch directly</a>';
  }

  isStreaming = false;
}

function openDrawer(service: ServiceKey = 'general') {
  const els = getElements();
  if (!els.drawer || !els.backdrop || !els.messagesEl || !els.input || !els.title) return;

  currentService = service;
  messages = [];
  els.messagesEl.innerHTML = '';

  const titles: Record<ServiceKey, string> = {
    consultations: 'camber/ai — consultations',
    automation: 'camber/ai — automation',
    training: 'camber/ai — training',
    'personal-ai': 'camber/ai — personal ai',
    general: 'camber/ai',
  };
  els.title.textContent = titles[service] || 'camber/ai';

  els.drawer.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  setTimeout(() => els.input?.focus(), 350);

  // Auto-send empty conversation to get the bot's opening line
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

  els.closeBtn?.addEventListener('click', closeDrawer);
  els.backdrop?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  els.sendBtn?.addEventListener('click', sendMessage);

  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isStreaming) {
      e.preventDefault();
      sendMessage();
    }
  });

  window.__openChatDrawer = openDrawer;
}
