import type { APIRoute } from 'astro';

export const prerender = false;

type TaskInput = {
  name: string;
  hoursPerMonth: number;
};

type EstimatedTask = {
  name: string;
  hoursPerMonth: number;
  automationPotentialPercent: number;
  estimatedHoursSavedPerMonth: number;
  note: string;
};

type EstimatePayload = {
  source: 'ai' | 'heuristic';
  tasks: EstimatedTask[];
  summary: {
    totalHoursPerMonth: number;
    estimatedHoursSavedPerMonth: number;
    estimatedHoursSavedPerYear: number;
    workingDaysRecoveredPerYear: number;
    confidence: 'low' | 'medium' | 'high';
    rationale: string;
  };
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

const keywordWeight = (taskName: string) => {
  const label = taskName.toLowerCase();
  const high = ['data entry', 'copy', 'paste', 'report', 'email', 'inbox', 'scheduling', 'calendar', 'invoice', 'crm update', 'admin'];
  const mid = ['research', 'proposal', 'analysis', 'support', 'summar', 'documentation', 'brief'];
  const low = ['architecture', 'strategy', 'creative', 'stakeholder', 'negotiation', 'complex coding'];

  if (high.some((kw) => label.includes(kw))) return 0.62;
  if (mid.some((kw) => label.includes(kw))) return 0.46;
  if (low.some((kw) => label.includes(kw))) return 0.28;
  return 0.42;
};

const buildHeuristicEstimate = (tasks: TaskInput[]): EstimatePayload => {
  const estimatedTasks = tasks.map((task) => {
    const potential = clamp(keywordWeight(task.name), 0.2, 0.75);
    const saved = round1(task.hoursPerMonth * potential);

    return {
      name: task.name,
      hoursPerMonth: round1(task.hoursPerMonth),
      automationPotentialPercent: Math.round(potential * 100),
      estimatedHoursSavedPerMonth: saved,
      note: 'Rule-based estimate'
    };
  });

  const totalHours = round1(estimatedTasks.reduce((sum, item) => sum + item.hoursPerMonth, 0));
  const savedMonthly = round1(estimatedTasks.reduce((sum, item) => sum + item.estimatedHoursSavedPerMonth, 0));
  const savedYearly = round1(savedMonthly * 12);
  const workingDays = round1(savedYearly / 8);

  return {
    source: 'heuristic',
    tasks: estimatedTasks,
    summary: {
      totalHoursPerMonth: totalHours,
      estimatedHoursSavedPerMonth: savedMonthly,
      estimatedHoursSavedPerYear: savedYearly,
      workingDaysRecoveredPerYear: workingDays,
      confidence: 'medium',
      rationale: 'Heuristic estimate using common automation potential for repetitive work categories.'
    }
  };
};

const parseTasks = async (request: Request): Promise<TaskInput[]> => {
  const body = await request.json();
  const tasksRaw = Array.isArray(body?.tasks) ? body.tasks : [];

  const tasks = tasksRaw
    .map((task: unknown) => {
      const name = typeof (task as { name?: unknown })?.name === 'string' ? (task as { name: string }).name.trim() : '';
      const hoursRaw = (task as { hoursPerMonth?: unknown })?.hoursPerMonth;
      const hours = typeof hoursRaw === 'number' ? hoursRaw : Number(hoursRaw);
      return { name, hoursPerMonth: hours };
    })
    .filter((task: TaskInput) => task.name.length > 1 && Number.isFinite(task.hoursPerMonth) && task.hoursPerMonth > 0)
    .slice(0, 8)
    .map((task: TaskInput) => ({
      name: task.name.slice(0, 100),
      hoursPerMonth: clamp(task.hoursPerMonth, 0.5, 500)
    }));

  return tasks;
};

const sanitizeAiEstimate = (aiData: unknown, fallbackTasks: TaskInput[]): EstimatePayload | null => {
  const obj = aiData as {
    tasks?: Array<{
      name?: unknown;
      hoursPerMonth?: unknown;
      automationPotentialPercent?: unknown;
      estimatedHoursSavedPerMonth?: unknown;
      note?: unknown;
    }>;
    summary?: {
      confidence?: unknown;
      rationale?: unknown;
    };
  };
  if (!Array.isArray(obj?.tasks) || obj.tasks.length === 0) return null;

  const normalizedTasks: EstimatedTask[] = obj.tasks.map((task, index) => {
    const fallback = fallbackTasks[index] || fallbackTasks[fallbackTasks.length - 1];
    const name = typeof task.name === 'string' && task.name.trim() ? task.name.trim() : fallback.name;
    const hoursPerMonth = clamp(Number(task.hoursPerMonth) || fallback.hoursPerMonth, 0.5, 500);
    const automationPotentialPercent = clamp(Number(task.automationPotentialPercent) || 40, 5, 90);
    const estimatedHoursSavedPerMonth = clamp(Number(task.estimatedHoursSavedPerMonth) || (hoursPerMonth * automationPotentialPercent) / 100, 0, hoursPerMonth);
    const note = typeof task.note === 'string' ? task.note.slice(0, 140) : 'AI estimate';

    return {
      name: name.slice(0, 100),
      hoursPerMonth: round1(hoursPerMonth),
      automationPotentialPercent: Math.round(automationPotentialPercent),
      estimatedHoursSavedPerMonth: round1(estimatedHoursSavedPerMonth),
      note
    };
  });

  const totalHours = round1(normalizedTasks.reduce((sum, item) => sum + item.hoursPerMonth, 0));
  const savedMonthly = round1(normalizedTasks.reduce((sum, item) => sum + item.estimatedHoursSavedPerMonth, 0));
  const savedYearly = round1(savedMonthly * 12);
  const workingDays = round1(savedYearly / 8);
  const confidenceRaw = obj.summary?.confidence;
  const confidence: 'low' | 'medium' | 'high' = confidenceRaw === 'low' || confidenceRaw === 'high' ? confidenceRaw : 'medium';
  const rationale = typeof obj.summary?.rationale === 'string'
    ? obj.summary.rationale.slice(0, 280)
    : 'AI-estimated based on automation suitability and workflow repeatability.';

  return {
    source: 'ai',
    tasks: normalizedTasks,
    summary: {
      totalHoursPerMonth: totalHours,
      estimatedHoursSavedPerMonth: savedMonthly,
      estimatedHoursSavedPerYear: savedYearly,
      workingDaysRecoveredPerYear: workingDays,
      confidence,
      rationale
    }
  };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const tasks = await parseTasks(request);
    if (tasks.length === 0) {
      return new Response(JSON.stringify({ error: 'Add at least one task with monthly hours.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fallback = buildHeuristicEstimate(tasks);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = [
      'You are an operations automation consultant.',
      'Estimate realistic monthly time savings from AI automation for each task.',
      'Be conservative and practical.',
      'Return strict JSON with this shape:',
      '{"tasks":[{"name":"string","hoursPerMonth":number,"automationPotentialPercent":number,"estimatedHoursSavedPerMonth":number,"note":"string"}],"summary":{"confidence":"low|medium|high","rationale":"string"}}'
    ].join(' ');

    const userPrompt = JSON.stringify({
      tasks,
      guidance: 'Do not exceed the listed monthly hours for each task.'
    });

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const parsed = JSON.parse(content) as unknown;
    const sanitized = sanitizeAiEstimate(parsed, tasks);
    if (!sanitized) {
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not estimate time savings.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
