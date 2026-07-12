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
let lastFocused: HTMLElement | null = null;

function getElements() {
  return {
    drawer: document.getElementById('chatDrawer'),
    backdrop: document.getElementById('chatBackdrop'),
    messagesEl: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput') as HTMLInputElement | null,
    closeBtn: document.getElementById('chatClose'),
    sendBtn: document.getElementById('chatSend'),
    title: document.getElementById('chatTitle'),
    chips: document.getElementById('chatChips'),
    fab: document.querySelector<HTMLElement>('.chat-fab'),
  };
}

function isOpen(): boolean {
  return document.getElementById('chatDrawer')?.getAttribute('aria-hidden') === 'false';
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

  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  currentService = service;
  messages = [];
  els.messagesEl.innerHTML = '';

  const titles: Record<ServiceKey, string> = {
    consultations: 'camber/ai // consultations',
    seo: 'camber/ai // seo',
    builds: 'camber/ai // builds',
    apps: 'camber/ai // apps',
    automation: 'camber/ai // automation',
    training: 'camber/ai // training',
    'personal-ai': 'camber/ai // personal ai',
    general: 'camber/ai',
  };
  els.title.textContent = titles[service] || 'camber/ai';

  (els.drawer as HTMLElement).inert = false;
  els.drawer.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  els.chips?.removeAttribute('hidden');
  if (els.fab) els.fab.hidden = true;

  setTimeout(() => els.input?.focus(), 350);

  // Auto-send empty conversation to get the bot's opening line
  streamResponse(els.messagesEl);
}

function closeDrawer() {
  const els = getElements();
  if (!els.drawer || !els.backdrop) return;

  els.drawer.setAttribute('aria-hidden', 'true');
  (els.drawer as HTMLElement).inert = true;
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (els.fab) els.fab.hidden = false;

  lastFocused?.focus();
  lastFocused = null;
}

function sendMessage(text?: string) {
  const els = getElements();
  if (!els.input || !els.messagesEl || isStreaming) return;

  const value = (text ?? els.input.value).trim();
  if (!value) return;

  els.input.value = '';
  els.chips?.setAttribute('hidden', '');
  messages.push({ role: 'user', content: value });
  appendMessage(els.messagesEl, 'user', value);
  streamResponse(els.messagesEl);
}

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !isOpen()) return;
  const drawer = document.getElementById('chatDrawer');
  if (!drawer) return;

  const focusables = Array.from(
    drawer.querySelectorAll<HTMLElement>('button, input, a[href]'),
  ).filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (!(active instanceof HTMLElement) || !drawer.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

export function initChatDrawer(): void {
  const els = getElements();
  if (!els.drawer) return;

  // Hidden drawers are inert: unfocusable and invisible to assistive tech.
  (els.drawer as HTMLElement).inert = true;

  els.closeBtn?.addEventListener('click', closeDrawer);
  els.backdrop?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
    trapFocus(e);
  });

  els.sendBtn?.addEventListener('click', () => sendMessage());

  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isStreaming) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.querySelectorAll<HTMLElement>('[data-chat-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      sendMessage(chip.textContent ?? '');
    });
  });

  window.__openChatDrawer = openDrawer;
}
