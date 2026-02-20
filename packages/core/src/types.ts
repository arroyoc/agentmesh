export interface AgentCard {
  squadklaw: string;
  agent_id: string;
  name: string;
  description?: string;
  owner?: {
    name: string;
    contact?: string;
  };
  endpoint: string;
  public_key: string;
  capabilities: string[];
  intents: string[];
  availability?: {
    timezone?: string;
    hours?: string;
    response_sla?: string;
  };
  access_control?: {
    mode: "open" | "allowlist" | "approval";
    allowlist?: string[];
    block?: string[];
  };
  metadata?: Record<string, string>;
}

export interface Message {
  squadklaw: string;
  message_id: string;
  conversation_id: string;
  from: string;
  to: string;
  timestamp: string;
  intent: string;
  payload: Record<string, unknown>;
  signature: string;
}

export interface MessageResponse {
  squadklaw: string;
  message_id: string;
  conversation_id: string;
  from: string;
  to: string;
  timestamp: string;
  intent: string;
  payload: Record<string, unknown>;
  signature: string;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    retry: boolean;
  };
}

export type ErrorCode =
  | "INVALID_MESSAGE"
  | "INVALID_SIGNATURE"
  | "INTENT_NOT_SUPPORTED"
  | "RATE_LIMITED"
  | "AGENT_UNAVAILABLE"
  | "CONVERSATION_CLOSED"
  | "UNAUTHORIZED"
  | "OWNER_REJECTED";

export type ConversationState = "open" | "completed" | "failed" | "expired";

export type AccessMode = "open" | "allowlist" | "approval";

// Standard intent types
export const STANDARD_INTENTS = {
  SCHEDULE: "mesh.schedule",
  MESSAGE: "mesh.message",
  REQUEST_INFO: "mesh.request_info",
  NEGOTIATE: "mesh.negotiate",
  HANDOFF: "mesh.handoff",
} as const;

// Schedule intent payloads
export interface ScheduleProposal {
  action: "propose";
  event: {
    title: string;
    proposed_times: string[];
    duration: string;
    location?: string;
    notes?: string;
  };
}

export interface ScheduleCounter {
  action: "counter";
  event: {
    selected_time?: string;
    proposed_times?: string[];
    duration?: string;
    location?: string;
    notes?: string;
  };
}

export interface ScheduleAccept {
  action: "accept";
  selected_time?: string;
}

export interface ScheduleDecline {
  action: "decline";
  reason?: string;
}

export type SchedulePayload =
  | ScheduleProposal
  | ScheduleCounter
  | ScheduleAccept
  | ScheduleDecline;

// Negotiate intent payloads
export interface NegotiatePayload {
  action: "propose" | "counter" | "accept" | "reject" | "withdraw";
  terms: {
    description: string;
    price?: string;
    conditions?: string[];
  };
}

// Message intent payloads
export interface MessagePayload {
  action: "deliver";
  message: {
    subject?: string;
    body: string;
    priority: "low" | "normal" | "high";
    reply_requested?: boolean;
  };
}

// Handoff payload
export interface HandoffPayload {
  action: "request_human";
  reason: string;
  preferred_channel?: "email" | "phone" | "chat";
}

// Pending approval response
export interface PendingApprovalPayload {
  action: "pending_approval";
  estimated_response: string;
  reason: string;
}
