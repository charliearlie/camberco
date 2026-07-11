// src/scripts/automation-demo.ts
// Lazy animated SVG workflow demo for /services/automation.

const EDGE_DURATION_MS = 1200;
const LOOP_PAUSE_MS = 1500;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// ─── Industry data map ───────────────────────────────────────────────────────
// Swaps node labels, status lines, and tooltip config strings.
// The animation engine (edges, particles, sequence) is untouched.

export const NODE_KEYS = ['email', 'claude', 'notion', 'slack'] as const;
export type NodeKey = (typeof NODE_KEYS)[number];

export interface IndustryNode {
  label: string;
  icon: string;
  status: string;
  configTitle: string;
  config: string;
}

export interface Industry {
  name: string;
  flow: string;
  title: string;
  nodes: Record<NodeKey, IndustryNode>;
}

export type IndustryKey = 'trades' | 'agency' | 'ecommerce' | 'clinic';

export const INDUSTRIES: Record<IndustryKey, Industry> = {
  trades: {
    name: 'Trades',
    flow: 'n8n run trades-flow',
    title:
      'Quote request received, AI drafts the estimate, then the job is booked in the calendar and the invoice is sent.',
    nodes: {
      email: {
        label: 'Quote request',
        icon: 'WhatsApp',
        status: 'received: new quote request',
        configTitle: 'Quote request trigger',
        config:
          'trigger: new WhatsApp or form message · filter: contains job details · payload: name, job, photos',
      },
      claude: {
        label: 'AI drafts estimate',
        icon: 'Claude',
        status: 'drafted: estimate ready',
        configTitle: 'AI drafts estimate',
        config:
          'model: claude · inputs: job description, your price list · output: itemised estimate for approval',
      },
      notion: {
        label: 'Job booked',
        icon: 'Calendar',
        status: 'booked: Tuesday 09:00',
        configTitle: 'Job booked in calendar',
        config: 'calendar: jobs diary · action: create booking · notify: customer confirmation text',
      },
      slack: {
        label: 'Invoice sent',
        icon: 'Xero',
        status: 'sent: invoice #204',
        configTitle: 'Invoice sent',
        config: 'ledger: Xero · action: draft and send invoice · terms: 14 days · reminder: auto chase',
      },
    },
  },
  agency: {
    name: 'Agency',
    flow: 'n8n run agency-flow',
    title:
      'A client brief lands, AI summarises it, then a task is created and a reply is drafted for review.',
    nodes: {
      email: {
        label: 'Brief lands',
        icon: 'Gmail',
        status: 'received: client brief',
        configTitle: 'Brief trigger',
        config: 'trigger: new email from a client domain · payload: brief, attachments, deadline',
      },
      claude: {
        label: 'AI summarises',
        icon: 'Claude',
        status: 'summarised: scope + deadline',
        configTitle: 'AI summarises brief',
        config: 'model: claude · output: scope summary, deadline, flagged gaps · tone: internal shorthand',
      },
      notion: {
        label: 'Task created',
        icon: 'Notion',
        status: 'created: task in sprint',
        configTitle: 'Task created',
        config: 'database: client work · fields: client, scope, owner, due date · action: create task',
      },
      slack: {
        label: 'Reply drafted',
        icon: 'Gmail',
        status: 'drafted: reply for review',
        configTitle: 'Reply drafted',
        config: 'draft: confirmation with timeline · state: saved to drafts · a human approves before send',
      },
    },
  },
  ecommerce: {
    name: 'E-commerce',
    flow: 'n8n run ecommerce-flow',
    title:
      'An order query arrives, AI classifies it, then the order is updated and the customer gets a reply.',
    nodes: {
      email: {
        label: 'Order query',
        icon: 'Email',
        status: 'received: where is my order',
        configTitle: 'Order query trigger',
        config: 'trigger: new support email · lookup: order number, courier status · payload: customer history',
      },
      claude: {
        label: 'AI classifies',
        icon: 'Claude',
        status: 'classified: delivery query',
        configTitle: 'AI classifies query',
        config: 'model: claude · classes: delivery, refund, exchange, other · escalate: anything ambiguous',
      },
      notion: {
        label: 'Order updated',
        icon: 'Shopify',
        status: 'updated: order #1182',
        configTitle: 'Order updated',
        config: 'store: Shopify · action: log query against the order · tag: delivery question',
      },
      slack: {
        label: 'Reply sent',
        icon: 'Email',
        status: 'sent: tracking link shared',
        configTitle: 'Reply sent',
        config: 'reply: courier status + tracking link · tone: brand voice · fallback: route to a human',
      },
    },
  },
  clinic: {
    name: 'Clinic',
    flow: 'n8n run clinic-flow',
    title:
      'A booking request arrives, AI checks the diary, then the appointment is booked and a reminder is scheduled.',
    nodes: {
      email: {
        label: 'Booking request',
        icon: 'Form',
        status: 'received: new patient request',
        configTitle: 'Booking request trigger',
        config: 'trigger: website form or voicemail transcript · payload: name, preferred times, reason',
      },
      claude: {
        label: 'AI checks diary',
        icon: 'Claude',
        status: 'matched: two open slots',
        configTitle: 'AI checks diary',
        config: 'model: claude · inputs: practitioner diaries, appointment type · output: best slot options',
      },
      notion: {
        label: 'Appointment booked',
        icon: 'Calendar',
        status: 'booked: Thu 14:30',
        configTitle: 'Appointment booked',
        config: 'calendar: clinic diary · action: create appointment · notify: front desk',
      },
      slack: {
        label: 'Reminder scheduled',
        icon: 'SMS',
        status: 'scheduled: 24h reminder',
        configTitle: 'Reminder scheduled',
        config: 'channel: SMS · schedule: 24 hours before · include: reschedule link',
      },
    },
  },
};

function applyIndustry(root: HTMLElement, industry: Industry): void {
  NODE_KEYS.forEach((key) => {
    const node = root.querySelector<SVGGElement>(`[data-automation-node="${key}"]`);
    if (!node) return;
    const data = industry.nodes[key];
    const label = node.querySelector<SVGTextElement>('.node-label');
    const icon = node.querySelector<SVGTextElement>('.node-icon');
    const status = node.querySelector<SVGTextElement>('.node-status');
    if (label) label.textContent = data.label;
    if (icon) icon.textContent = data.icon;
    if (status) status.textContent = data.status;
    node.dataset['configTitle'] = data.configTitle;
    node.dataset['config'] = data.config;
  });

  const topline = root.querySelector<HTMLElement>('.graph-topline span');
  if (topline) topline.textContent = `$ ${industry.flow}`;

  const svgTitle = root.querySelector<SVGTitleElement>('#automation-title');
  if (svgTitle) svgTitle.textContent = industry.title;
}

function initTooltip(root: HTMLElement): void {
  const tooltip = root.querySelector<HTMLElement>('[data-automation-tooltip]');
  if (!tooltip) return;

  function hide(): void {
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function position(source: Element): void {
    const rect = source.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const gap = 10;
    const pad = 8;

    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - gap;

    if (top < pad) top = rect.bottom + gap;
    left = clamp(left, pad, window.innerWidth - tipRect.width - pad);
    top = clamp(top, pad, window.innerHeight - tipRect.height - pad);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  root.querySelectorAll<SVGGElement>('[data-automation-node]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      const title = node.dataset['configTitle'] ?? 'Config';
      const config = node.dataset['config'] ?? '';
      tooltip.innerHTML = '';

      const titleEl = document.createElement('strong');
      titleEl.textContent = title;
      const bodyEl = document.createElement('span');
      bodyEl.textContent = config;
      tooltip.append(titleEl, bodyEl);

      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden', 'false');
      position(node);
    });
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (!target?.closest('[data-automation-node]')) hide();
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target as Node)) hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide, { passive: true });
}

function initOneAutomationDemo(root: HTMLElement): void {
  const paths = new Map<string, SVGPathElement>();
  root.querySelectorAll<SVGPathElement>('[data-edge]').forEach((path) => {
    paths.set(path.dataset['edge'] ?? '', path);
  });

  const nodes = new Map<string, SVGGElement>();
  root.querySelectorAll<SVGGElement>('[data-automation-node]').forEach((node) => {
    nodes.set(node.dataset['automationNode'] ?? '', node);
  });

  const particles = Array.from(root.querySelectorAll<SVGCircleElement>('[data-particle]'));
  const runAgain = root.querySelector<HTMLButtonElement>('[data-automation-run]');

  let runToken = 0;
  let hasBooted = false;

  function lightNode(key: string): void {
    nodes.get(key)?.classList.add('is-lit');
  }

  function resetGraph(): void {
    nodes.forEach((node) => node.classList.remove('is-lit'));
    particles.forEach((particle) => {
      particle.style.opacity = '0';
    });
  }

  function renderStatic(): void {
    nodes.forEach((node) => node.classList.add('is-lit'));
    particles.forEach((particle) => {
      particle.style.opacity = '0';
    });
    root.classList.add('is-static');
  }

  function animateEdge(edgeKey: string, particleIndex: number, token: number): Promise<void> {
    const path = paths.get(edgeKey);
    const particle = particles[particleIndex];
    if (!path || !particle) return Promise.resolve();

    const length = path.getTotalLength();
    const start = performance.now();
    particle.style.opacity = '1';

    return new Promise((resolve) => {
      function tick(now: number): void {
        if (token !== runToken) {
          particle.style.opacity = '0';
          resolve();
          return;
        }

        const progress = Math.min((now - start) / EDGE_DURATION_MS, 1);
        const point = path.getPointAtLength(length * progress);
        particle.setAttribute('cx', String(point.x));
        particle.setAttribute('cy', String(point.y));

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          particle.style.opacity = '0';
          resolve();
        }
      }

      window.requestAnimationFrame(tick);
    });
  }

  async function runSequence(): Promise<void> {
    runToken += 1;
    const token = runToken;
    root.classList.remove('is-static');
    resetGraph();

    if (prefersReducedMotion()) {
      renderStatic();
      return;
    }

    lightNode('email');
    await wait(240);
    if (token !== runToken) return;

    await animateEdge('email-claude', 0, token);
    if (token !== runToken) return;
    lightNode('claude');
    await wait(220);
    if (token !== runToken) return;

    await Promise.all([
      animateEdge('claude-notion', 1, token).then(() => lightNode('notion')),
      animateEdge('claude-slack', 2, token).then(() => lightNode('slack')),
    ]);
    if (token !== runToken) return;

    await wait(LOOP_PAUSE_MS);
    if (token === runToken) runSequence();
  }

  runAgain?.addEventListener('click', () => {
    runSequence();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-automation-industry]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset['automationIndustry'] as IndustryKey | undefined;
      const industry = key ? INDUSTRIES[key] : undefined;
      if (!industry) return;

      root.querySelectorAll<HTMLButtonElement>('[data-automation-industry]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === button));
        b.classList.toggle('is-active', b === button);
      });

      applyIndustry(root, industry);
      hasBooted = true;
      runSequence();
    });
  });

  initTooltip(root);

  function boot(): void {
    if (hasBooted) return;
    hasBooted = true;
    runSequence();
  }

  if (!('IntersectionObserver' in window)) {
    boot();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(root);
        boot();
      });
    },
    { threshold: 0.25 },
  );

  observer.observe(root);
}

export function initAutomationDemo(): void {
  document.querySelectorAll<HTMLElement>('[data-automation-demo]').forEach(initOneAutomationDemo);
}
