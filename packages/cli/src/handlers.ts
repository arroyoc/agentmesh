import type { Message } from "@squadklaw/core";

interface HandlerContext {
  agentName: string;
  agentId: string;
}

interface HandlerResult {
  payload: Record<string, unknown>;
  log: string[];
}

/**
 * Route an incoming message to the appropriate intent handler.
 */
export function handleMessage(message: Message, ctx: HandlerContext): HandlerResult {
  switch (message.intent) {
    case "mesh.schedule":
      return handleSchedule(message, ctx);
    case "mesh.message":
      return handleDeliverMessage(message, ctx);
    case "mesh.negotiate":
      return handleNegotiate(message, ctx);
    case "mesh.request_info":
      return handleRequestInfo(message, ctx);
    case "mesh.handoff":
      return handleHandoff(message, ctx);
    default:
      return {
        payload: { action: "acknowledged", message: `Received intent: ${message.intent}` },
        log: [`Unknown intent "${message.intent}", acknowledged`],
      };
  }
}

function handleSchedule(message: Message, ctx: HandlerContext): HandlerResult {
  const payload = message.payload as Record<string, unknown>;
  const action = payload.action as string;

  switch (action) {
    case "propose": {
      const event = payload.event as {
        title?: string;
        proposed_times?: string[];
        duration?: string;
        location?: string;
        notes?: string;
      };

      const times = event?.proposed_times ?? [];
      // Pick a time — prefer the second option if available (shows preference logic)
      const selectedTime = times.length > 1 ? times[1] : times[0];

      // Maybe suggest a better duration
      const originalDuration = event?.duration ?? "30m";
      const durationMinutes = parseInt(originalDuration);
      const newDuration = durationMinutes && durationMinutes < 45 ? "45m" : originalDuration;

      // Suggest a location if none provided
      const location = event?.location ?? "Sightglass Coffee, SoMa";

      const log = [
        `Schedule proposal: "${event?.title ?? "Meeting"}"`,
        `  ${times.length} time(s) proposed`,
        `  Selected: ${selectedTime ? formatTime(selectedTime) : "first available"}`,
        newDuration !== originalDuration
          ? `  Extended duration: ${originalDuration} → ${newDuration}`
          : `  Duration: ${originalDuration}`,
        event?.location ? `  Location: ${event.location}` : `  Suggested location: ${location}`,
        `  → Responding with COUNTER`,
      ];

      return {
        payload: {
          action: "counter",
          event: {
            title: event?.title,
            selected_time: selectedTime,
            duration: newDuration,
            location,
            notes: `${ctx.agentName} prefers this time. Looking forward to it!`,
          },
        },
        log,
      };
    }

    case "counter": {
      const event = payload.event as {
        title?: string;
        selected_time?: string;
        duration?: string;
        location?: string;
      };

      const log = [
        `Counter-proposal received`,
        event?.selected_time ? `  Time: ${formatTime(event.selected_time)}` : "",
        event?.duration ? `  Duration: ${event.duration}` : "",
        event?.location ? `  Location: ${event.location}` : "",
        `  → Responding with ACCEPT`,
      ].filter(Boolean);

      return {
        payload: {
          action: "accept",
          selected_time: event?.selected_time,
          message: `${ctx.agentName} confirms. See you there!`,
        },
        log,
      };
    }

    case "accept": {
      const log = [
        `Meeting ACCEPTED by ${message.from}`,
        `  → Confirmed. Meeting is scheduled.`,
      ];

      return {
        payload: {
          action: "confirmed",
          message: "Meeting confirmed and added to calendar.",
        },
        log,
      };
    }

    case "decline": {
      const reason = (payload.reason as string) || "No reason given";
      const log = [
        `Meeting DECLINED by ${message.from}`,
        `  Reason: ${reason}`,
      ];

      return {
        payload: {
          action: "acknowledged",
          message: "Understood. Let me know if you'd like to reschedule.",
        },
        log,
      };
    }

    default:
      return {
        payload: { action: "acknowledged", message: `Unknown schedule action: ${action}` },
        log: [`Unknown schedule action "${action}"`],
      };
  }
}

function handleDeliverMessage(message: Message, ctx: HandlerContext): HandlerResult {
  const payload = message.payload as Record<string, unknown>;
  const msg = payload.message as {
    subject?: string;
    body?: string;
    priority?: string;
    reply_requested?: boolean;
  };

  const log = [
    `Message delivered`,
    msg?.subject ? `  Subject: ${msg.subject}` : "",
    msg?.body ? `  Body: ${msg.body.slice(0, 100)}${msg.body.length > 100 ? "..." : ""}` : "",
    msg?.priority ? `  Priority: ${msg.priority}` : "",
    msg?.reply_requested ? `  Reply requested: yes` : "",
    `  → Acknowledged`,
  ].filter(Boolean);

  const responsePayload: Record<string, unknown> = {
    action: "received",
    message: `${ctx.agentName} received your message.`,
  };

  if (msg?.reply_requested) {
    responsePayload.message = `${ctx.agentName} received your message and will respond shortly.`;
    responsePayload.will_reply = true;
  }

  return { payload: responsePayload, log };
}

function handleNegotiate(message: Message, ctx: HandlerContext): HandlerResult {
  const payload = message.payload as Record<string, unknown>;
  const action = payload.action as string;
  const terms = payload.terms as { description?: string; price?: string; conditions?: string[] };

  switch (action) {
    case "propose": {
      const log = [
        `Negotiation proposal received`,
        terms?.description ? `  Terms: ${terms.description}` : "",
        terms?.price ? `  Price: ${terms.price}` : "",
        `  → Responding with COUNTER`,
      ].filter(Boolean);

      return {
        payload: {
          action: "counter",
          terms: {
            description: terms?.description ?? "Counter-proposal",
            price: terms?.price,
            conditions: [
              ...(terms?.conditions ?? []),
              `Reviewed and adjusted by ${ctx.agentName}`,
            ],
          },
        },
        log,
      };
    }

    case "counter": {
      const log = [
        `Counter-proposal received`,
        `  → Accepting terms`,
      ];

      return {
        payload: {
          action: "accept",
          terms: terms ?? {},
          message: `${ctx.agentName} accepts the terms.`,
        },
        log,
      };
    }

    case "accept":
      return {
        payload: { action: "confirmed", message: "Deal confirmed." },
        log: [`Negotiation ACCEPTED. Deal confirmed.`],
      };

    case "reject":
      return {
        payload: { action: "acknowledged", message: "Understood. Negotiation closed." },
        log: [`Negotiation REJECTED by ${message.from}`],
      };

    default:
      return {
        payload: { action: "acknowledged" },
        log: [`Unknown negotiate action "${action}"`],
      };
  }
}

function handleRequestInfo(message: Message, ctx: HandlerContext): HandlerResult {
  const payload = message.payload as Record<string, unknown>;
  const query = (payload.query as string) ?? "";

  return {
    payload: {
      action: "response",
      info: {
        agent: ctx.agentName,
        agent_id: ctx.agentId,
        message: `This is ${ctx.agentName}. I can help with scheduling, messaging, and negotiations.`,
        query_received: query,
      },
    },
    log: [
      `Info request: "${query || "(no query)"}"`,
      `  → Responded with agent info`,
    ],
  };
}

function handleHandoff(message: Message, ctx: HandlerContext): HandlerResult {
  const payload = message.payload as Record<string, unknown>;
  const reason = (payload.reason as string) ?? "No reason provided";
  const channel = (payload.preferred_channel as string) ?? "chat";

  return {
    payload: {
      action: "pending_approval",
      estimated_response: "5m",
      reason: `Escalating to ${ctx.agentName}'s owner via ${channel}`,
    },
    log: [
      `Handoff request: ${reason}`,
      `  Preferred channel: ${channel}`,
      `  → Pending owner approval (est. 5m)`,
    ],
  };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}
