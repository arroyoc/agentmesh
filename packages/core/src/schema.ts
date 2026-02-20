import { z } from "zod";

const AGENT_ID_PREFIX = "sk_";
const MESSAGE_ID_PREFIX = "msg_";
const CONVERSATION_ID_PREFIX = "conv_";

export const AgentCardSchema = z.object({
  squadklaw: z.string(),
  agent_id: z.string().startsWith(AGENT_ID_PREFIX),
  name: z.string().min(1).max(256),
  description: z.string().max(1024).optional(),
  owner: z
    .object({
      name: z.string().min(1),
      contact: z.string().optional(),
    })
    .optional(),
  endpoint: z.string().url().startsWith("https://"),
  public_key: z.string().min(1),
  capabilities: z.array(z.string()).min(1),
  intents: z.array(z.string()).min(1),
  availability: z
    .object({
      timezone: z.string().optional(),
      hours: z.string().optional(),
      response_sla: z.string().optional(),
    })
    .optional(),
  access_control: z
    .object({
      mode: z.enum(["open", "allowlist", "approval"]),
      allowlist: z.array(z.string()).optional(),
      block: z.array(z.string()).optional(),
    })
    .optional(),
  metadata: z.record(z.string()).optional(),
});

export const MessageSchema = z.object({
  squadklaw: z.string(),
  message_id: z.string().startsWith(MESSAGE_ID_PREFIX),
  conversation_id: z.string().startsWith(CONVERSATION_ID_PREFIX),
  from: z.string().startsWith(AGENT_ID_PREFIX),
  to: z.string().startsWith(AGENT_ID_PREFIX),
  timestamp: z.string().datetime(),
  intent: z.string().min(1),
  payload: z.record(z.unknown()),
  signature: z.string().min(1),
});

export const DirectoryQuerySchema = z.object({
  capability: z.string().optional(),
  intent: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      "INVALID_MESSAGE",
      "INVALID_SIGNATURE",
      "INTENT_NOT_SUPPORTED",
      "RATE_LIMITED",
      "AGENT_UNAVAILABLE",
      "CONVERSATION_CLOSED",
      "UNAUTHORIZED",
      "OWNER_REJECTED",
    ]),
    message: z.string(),
    retry: z.boolean(),
  }),
});

export type ValidatedAgentCard = z.infer<typeof AgentCardSchema>;
export type ValidatedMessage = z.infer<typeof MessageSchema>;
export type DirectoryQuery = z.infer<typeof DirectoryQuerySchema>;
