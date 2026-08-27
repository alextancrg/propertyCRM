import { prisma } from "./prisma";

// The WhatsApp AI agent is pre-configured for a DeepSeek-compatible OpenAI
// endpoint. The model name is fixed at deployment (deepseek-v4-flash) and is
// hidden from the UI; the API key lives in an env var (never in the DB):
//   AI_API_KEY    — the API key you provide (falls back to OPENAI_API_KEY)
//   AI_BASE_URL   — default https://api.deepseek.com/v1
//   AI_MODEL      — default deepseek-v4-flash
const DEFAULT_MODEL = process.env.AI_MODEL || "deepseek-v4-flash";
const DEFAULT_PROVIDER = "deepseek";

export type AgentConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  greeting: string;
  escalationEmail: string | null;
  autonomyLevel: string; // "semi" | "full"
  autoRentReminder: boolean;
  autoMaintenanceTriage: boolean;
  autoViewingSchedule: boolean;
  tenantNames: string;
  // Rent reminder timing — days relative to the property's rent due date
  // (negative = days before the due date, positive = days after).
  reminderDays1: number;
  reminderDays2: number;
  reminderDays3: number;
  // Self-escalation: days overdue before the red self-WhatsApp alert fires.
  reminderEscalationDays: number;
};

export async function getAgentConfig(): Promise<AgentConfig> {
  const cfg = await prisma.aiAgentConfig.findUnique({ where: { id: "default" } });
  if (!cfg) {
    return {
      enabled: true,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt:
        "You are the AI assistant for a property management office. Be polite, concise, and factual.",
      greeting: "Hi, this is the property management office. How can I help you today?",
      escalationEmail: null,
      autonomyLevel: "semi",
      autoRentReminder: true,
      autoMaintenanceTriage: true,
      autoViewingSchedule: true,
      tenantNames: "",
      reminderDays1: -3,
      reminderDays2: 1,
      reminderDays3: 3,
      reminderEscalationDays: 6,
    };
  }
  // Migration: rows created before the DeepSeek era defaulted to provider
  // "mock" / model "gpt-4o-mini". Treat them as the new default so the agent
  // is pre-configured for deepseek-v4-flash without a manual DB update (the
  // model/provider are hidden in the UI and not user-editable anymore).
  const migrated = cfg.provider === "mock";
  return {
    enabled: cfg.enabled,
    provider: migrated ? DEFAULT_PROVIDER : cfg.provider,
    model: migrated ? DEFAULT_MODEL : cfg.model || DEFAULT_MODEL,
    systemPrompt: cfg.systemPrompt,
    greeting: cfg.greeting,
    escalationEmail: cfg.escalationEmail,
    autonomyLevel: cfg.autonomyLevel || "semi",
    autoRentReminder: cfg.autoRentReminder,
    autoMaintenanceTriage: cfg.autoMaintenanceTriage,
    autoViewingSchedule: cfg.autoViewingSchedule,
    tenantNames: cfg.tenantNames,
    reminderDays1: cfg.reminderDays1 ?? -3,
    reminderDays2: cfg.reminderDays2 ?? 1,
    reminderDays3: cfg.reminderDays3 ?? 3,
    reminderEscalationDays: cfg.reminderEscalationDays ?? 6,
  };
}

export type ChatTurn = { role: "tenant" | "ai"; content: string };

/**
 * Deterministic, rule-based assistant used when no LLM key is configured.
 * Mirrors the behaviours described in the CRM: rent reminders, maintenance
 * triage, viewing scheduling.
 */
export function mockAssistantReply(message: string, config: AgentConfig): string {
  const msg = message.toLowerCase();
  // "full" = fully autonomous (agent takes action itself);
  // "semi"  = human-in-the-loop (agent chats but defers decisions/escalations).
  const full = config.autonomyLevel === "full";

  if (/(rent|overdue|payment|arrear|bayar|sewa)/.test(msg)) {
    if (!config.autoRentReminder) {
      return "I understand you have a question about rent. I've escalated this to the property manager, who will follow up shortly.";
    }
    return full
      ? "I can help with that. Based on the ledger, your rent for the current cycle is overdue. I have logged a promise-to-pay note — you can settle via the payment link sent to your WhatsApp. Would you like to confirm a payment date?"
      : "I understand you have a question about rent. In semi-autonomous mode I've escalated this to the property manager, who will confirm your payment arrangement shortly.";
  }

  if (/(leak|burst|pipe|plumb|repair|rosak|bocor|electric|aircond|air-cond|maintenance)/.test(msg)) {
    if (!config.autoMaintenanceTriage) {
      return "Thanks for reporting this. The AI agent is currently paused for maintenance requests — the property manager has been notified.";
    }
    return full
      ? "Thanks for reporting this. I've triaged the issue as a maintenance request and logged it for the property manager. Is this an emergency (e.g. flooding, no electricity)?"
      : "Thanks for reporting this. In semi-autonomous mode I've logged it and the property manager will triage the maintenance request shortly. Is this an emergency?";
  }

  if (/(view|viewing|tour|rent out|sewa|available unit|vacant)/.test(msg)) {
    if (!config.autoViewingSchedule) {
      return "Thanks for your interest. Our viewing scheduling is handled directly by the property manager — I'll pass your details along.";
    }
    return full
      ? "We currently have available units in the portfolio. I can propose a viewing slot — does Tuesday 6pm or Saturday 10am work better for you?"
      : "Thanks for your interest. I'll pass your details to the property manager, who will arrange a viewing slot for you.";
  }

  if (/(hello|hi|hey|salam|good (morning|afternoon|evening))/i.test(msg)) {
    return config.greeting || "Hi, this is the property management office. How can I help you today?";
  }

  return "Thanks for your message. I've noted it in the CRM and the property manager will respond shortly if follow-up is needed.";
}

/**
 * Generate the agent's reply. Uses a real LLM when provider != "mock" and a key
 * is present; otherwise falls back to the deterministic assistant.
 */
export async function generateAgentReply(
  history: ChatTurn[],
  config: AgentConfig,
): Promise<{ reply: string; provider: string }> {
  const last = history[history.length - 1]?.content ?? "";
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (config.provider === "mock" || !apiKey) {
    return { reply: mockAssistantReply(last, config), provider: "mock" };
  }

  try {
    const base = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1").replace(
      /\/$/,
      "",
    );
    const model = process.env.AI_MODEL || config.model || DEFAULT_MODEL;

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: config.systemPrompt },
          ...history.map((t) => ({ role: t.role === "ai" ? "assistant" : "user", content: t.content })),
        ],
        temperature: 0.4,
        max_tokens: 320,
      }),
    });

    if (!res.ok) {
      // Graceful fallback if the LLM call fails.
      return { reply: mockAssistantReply(last, config), provider: "mock" };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim();
    return { reply: reply || mockAssistantReply(last, config), provider: "deepseek" };
  } catch {
    return { reply: mockAssistantReply(last, config), provider: "mock" };
  }
}

/**
 * Log a mutation to the audit trail (used for tax-audit readiness and the
 * "updated by <property manager>" trail).
 */
export async function logAudit(
  entityType: string,
  action: string,
  description: string,
  entityId?: string,
  userId?: string,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType,
      action,
      description,
      entityId: entityId ?? null,
      userId: userId ?? null,
    },
  });
}
