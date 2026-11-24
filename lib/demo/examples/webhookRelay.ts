import type { Question } from "@/lib/schemas/analysis";
import type { ProjectSpecification } from "@/lib/schemas/specification";
import type { DemoExample } from "../types";

const latency: Question = {
  id: "Q-001",
  category: "constraints",
  question: "How long may an event wait before it must reach the consuming service?",
  reason: "Sets the retry schedule and the alert thresholds.",
  importance: "required",
};
const duplicates: Question = {
  id: "Q-002",
  category: "quality",
  question: "Can the consuming services safely process the same event twice?",
  reason:
    "Decides between exactly-once delivery and at-least-once delivery with event IDs.",
  importance: "required",
};
const retention: Question = {
  id: "Q-003",
  category: "data",
  question:
    "How long must received events be kept, and can they contain personal data?",
  reason: "Drives storage, retention, and data protection requirements.",
  importance: "required",
};
const broker: Question = {
  id: "Q-004",
  category: "technology",
  question: "Which message broker should the relay use?",
  reason: "Affects the infrastructure choices.",
  importance: "optional",
};
const replay: Question = {
  id: "Q-005",
  category: "functionality",
  question:
    "Should operators be able to replay a failed or already delivered event manually?",
  reason: "Replay is the usual recovery path after a consumer bug.",
  importance: "recommended",
};
const alerting: Question = {
  id: "Q-006",
  category: "quality",
  question:
    "Who should be alerted when an event cannot be delivered, and through which channel?",
  reason: "Without an owner, undeliverable events go unnoticed.",
  importance: "recommended",
};

const draft: ProjectSpecification = {
  projectName: "Payment webhook relay",
  goal: "Receive payment provider webhooks at one verified endpoint, store them durably, and deliver them to the order and billing services at least once within 15 minutes, including during deploys.",
  scope: [
    "One public webhook endpoint with signature verification",
    "Durable storage of accepted events for 30 days",
    "Delivery to each consumer with retries and exponential backoff",
    "Dead-letter state and an alert when retries are exhausted",
    "Admin screen to inspect one event and replay it",
  ],
  outOfScope: [
    "Bulk replay",
    "Exactly-once delivery",
    "Transforming or enriching payloads",
    "Webhooks from other providers",
  ],
  users: [
    "Order and billing services (consumers)",
    "Payments on-call engineers",
    "Platform operators",
  ],
  functionalRequirements: [
    {
      id: "FR-001",
      description:
        "Verify each incoming webhook's provider signature and reject unverifiable requests with HTTP 401 without storing them.",
    },
    {
      id: "FR-002",
      description:
        "Store each verified event durably before acknowledging it to the provider with HTTP 2xx.",
    },
    {
      id: "FR-003",
      description:
        "Ignore duplicate provider event IDs at ingestion while still acknowledging them.",
    },
    {
      id: "FR-004",
      description:
        "Deliver each event to every subscribed consumer at least once, retrying with exponential backoff for up to 60 minutes.",
    },
    {
      id: "FR-005",
      description:
        "Move an event to a dead-letter state for a consumer when its retries are exhausted, and alert the payments on-call engineer.",
    },
    {
      id: "FR-006",
      description:
        "Operators can view an event's delivery attempts and replay it to one consumer from an admin screen.",
    },
  ],
  nonFunctionalRequirements: [
    {
      id: "NFR-001",
      description:
        "In normal operation, 99% of events reach each consumer within 15 minutes of receipt.",
    },
    {
      id: "NFR-002",
      description: "Delete event payloads 30 days after receipt.",
    },
    {
      id: "NFR-003",
      description:
        "Encrypt stored payloads at rest and restrict the admin screen to operators.",
    },
  ],
  technologyConstraints: [
    "Run next to the existing services and reuse the team's existing alerting channel.",
  ],
  dataRequirements: [
    "Store the event ID, type, receipt time, payload, and every delivery attempt per consumer.",
    "Payloads contain customer names and email addresses and are personal data.",
  ],
  acceptanceCriteria: [
    {
      id: "AC-001",
      requirementId: "FR-001",
      criterion:
        "A request with an invalid signature returns 401 and creates no stored event.",
    },
    {
      id: "AC-002",
      requirementId: "FR-002",
      criterion:
        "When storage is unavailable, the endpoint returns 5xx so the provider retries; no 2xx is sent for an unstored event.",
    },
    {
      id: "AC-003",
      requirementId: "FR-003",
      criterion:
        "Sending the same event ID twice stores one event and returns 2xx both times.",
    },
    {
      id: "AC-004",
      requirementId: "FR-004",
      criterion:
        "With a consumer down for 10 minutes, its events are delivered after it recovers without manual action.",
    },
    {
      id: "AC-005",
      requirementId: "FR-005",
      criterion:
        "After 60 minutes of failed attempts, the event is dead-lettered for that consumer and exactly one alert is sent.",
    },
    {
      id: "AC-006",
      requirementId: "FR-006",
      criterion:
        "Replaying a dead-lettered event delivers it to the selected consumer and records the attempt.",
    },
    {
      id: "AC-007",
      requirementId: "NFR-001",
      criterion:
        "A load test at twice the current peak rate delivers 99% of events within 15 minutes.",
    },
    {
      id: "AC-008",
      requirementId: "NFR-002",
      criterion:
        "A daily cleanup removes payloads older than 30 days and keeps the delivery metadata.",
    },
    {
      id: "AC-009",
      requirementId: "NFR-003",
      criterion:
        "Stored payloads are unreadable without the encryption key, and non-operators receive 403 from the admin screen.",
    },
  ],
  edgeCases: [
    "The provider sends events out of order.",
    "A consumer returns 2xx after its delivery timeout has elapsed.",
    "A deploy restarts the relay while deliveries are in progress.",
  ],
  assumptions: [
    "Consumers confirm a delivery by returning HTTP 2xx within 10 seconds.",
  ],
  unresolvedQuestions: [],
  implementationTasks: [
    {
      id: "TASK-001",
      title: "Storage and retention",
      description:
        "Create the event and delivery-attempt tables, payload encryption, and the 30-day cleanup job.",
      requirementIds: ["NFR-002", "NFR-003"],
      dependencies: [],
    },
    {
      id: "TASK-002",
      title: "Ingestion endpoint",
      description:
        "Verify signatures, deduplicate by event ID, and store events before acknowledging them.",
      requirementIds: ["FR-001", "FR-002", "FR-003"],
      dependencies: ["TASK-001"],
    },
    {
      id: "TASK-003",
      title: "Delivery worker",
      description:
        "Deliver events to each consumer with exponential backoff and record every attempt.",
      requirementIds: ["FR-004", "NFR-001"],
      dependencies: ["TASK-002"],
    },
    {
      id: "TASK-004",
      title: "Dead-letter handling and alerting",
      description:
        "Dead-letter events after 60 minutes of failures and alert the on-call engineer.",
      requirementIds: ["FR-005"],
      dependencies: ["TASK-003"],
    },
    {
      id: "TASK-005",
      title: "Admin screen",
      description:
        "List events and attempts, replay one event to one consumer, and restrict access to operators.",
      requirementIds: ["FR-006", "NFR-003"],
      dependencies: ["TASK-003"],
    },
  ],
  implementationPrompt:
    "Build a webhook relay for payment events. Verify signatures (FR-001), store before acknowledging (FR-002), and deduplicate by event ID (FR-003). Deliver at least once with exponential backoff for up to 60 minutes (FR-004), dead-letter and alert afterwards (FR-005), and offer single-event replay to operators (FR-006). Meet NFR-001 to NFR-003. Implement TASK-001 to TASK-005 in dependency order and verify AC-001 to AC-009.",
};

const finalSpecification: ProjectSpecification = {
  ...draft,
  functionalRequirements: [
    ...draft.functionalRequirements,
    {
      id: "FR-007",
      description:
        "Every delivery, including retries and replays, carries the provider's original event ID so consumers can deduplicate.",
    },
    {
      id: "FR-008",
      description:
        "Alert the payments on-call engineer when an event is still undelivered to a consumer 15 minutes after receipt.",
    },
  ],
  acceptanceCriteria: [
    ...draft.acceptanceCriteria,
    {
      id: "AC-010",
      requirementId: "FR-007",
      criterion:
        "A replayed event reaches the consumer with the same event ID as the original delivery.",
    },
    {
      id: "AC-011",
      requirementId: "FR-008",
      criterion:
        "With a consumer down for 16 minutes, one latency alert is sent before the event is dead-lettered.",
    },
  ],
  unresolvedQuestions: [
    "Must events for the same payment be delivered in order, or can the consumers handle out-of-order events?",
  ],
  implementationTasks: draft.implementationTasks.map((task) =>
    task.id === "TASK-003"
      ? { ...task, requirementIds: ["FR-004", "FR-007", "NFR-001"] }
      : task.id === "TASK-004"
        ? {
            ...task,
            title: "Latency alerts, dead-lettering, and alerting",
            description:
              "Alert when an event is undelivered after 15 minutes, dead-letter it after 60 minutes of failures, and alert the on-call engineer.",
            requirementIds: ["FR-005", "FR-008"],
          }
        : task,
  ),
  implementationPrompt:
    "Build a webhook relay for payment events. Verify signatures (FR-001), store before acknowledging (FR-002), and deduplicate by event ID (FR-003). Deliver at least once with exponential backoff for up to 60 minutes (FR-004), always carrying the original event ID (FR-007). Alert after 15 minutes without delivery (FR-008), dead-letter and alert after 60 minutes (FR-005), and offer single-event replay to operators (FR-006). Meet NFR-001 to NFR-003. Implement TASK-001 to TASK-005 in dependency order and verify AC-001 to AC-011. Event ordering is an open decision: ask before relying on any ordering.",
};

export const webhookRelayExample: DemoExample = {
  id: "webhook-relay",
  title: "Payment webhook relay",
  summary:
    "A production system with reliability, retention, and alerting decisions.",
  idea: {
    description:
      "A service that receives webhooks from our payment provider, verifies them, and forwards them reliably to our internal order and billing services. Today we lose events when a service is down during a deploy.",
    complexity: "production_system",
  },
  answers: {
    "Q-001":
      "Within 15 minutes in normal operation. Our deploys take up to 10 minutes.",
    "Q-002": "Yes. Both services deduplicate by the provider's event ID.",
    "Q-003":
      "30 days. Payloads contain customer names and email addresses.",
    "Q-005":
      "Yes, replay a single event from an admin screen. Bulk replay can wait.",
    "Q-006":
      "The payments on-call engineer, through our existing alerting channel.",
  },
  analysis: {
    analysis: {
      understoodGoal:
        "Stop losing payment webhooks by accepting them at one verified entry point, storing them durably, and delivering them to internal services with retries.",
      knownFacts: [
        "Events come from a payment provider.",
        "The order and billing services consume the events.",
        "Events are lost when a consumer is down during a deploy.",
      ],
      assumptions: [
        "The payment provider signs webhooks with a shared secret.",
        "Consumers can handle the same event more than once.",
      ],
      ambiguities: [
        "The acceptable delivery delay is unspecified.",
        "How long events must be retained is unspecified.",
        "Who is alerted when delivery keeps failing is unspecified.",
      ],
      questions: [latency, duplicates, retention, broker],
    },
    review: {
      assessment:
        "The questions target the real failure mode. The broker question presumes a solution rather than a requirement. Manual replay and alert ownership are missing.",
      challengedAssumptions: [
        "The signature scheme is assumed; the requirement should name verification without fixing the scheme.",
        "Consumer idempotency is assumed; it decides the delivery guarantee, so it must be confirmed.",
      ],
      missingTopics: [
        "Manual replay of failed events",
        "Alerting and on-call ownership",
      ],
      removedQuestionIds: ["Q-004"],
      addedQuestions: [replay, alerting],
      finalQuestions: [latency, duplicates, retention, replay, alerting],
    },
    questions: [latency, duplicates, retention, replay, alerting],
  },
  specification: {
    draft,
    review: {
      verdict: "changes_required",
      summary:
        "The draft is close. Make replays safe for deduplicating consumers, alert on the latency target, and decide how ordering is handled.",
      issues: [
        {
          severity: "high",
          category: "missing_requirement",
          description:
            "Replays rely on consumer deduplication, but the specification never states that deliveries keep the original event ID.",
          recommendedChange:
            "State that every delivery and replay carries the provider's original event ID.",
        },
        {
          severity: "medium",
          category: "contradiction",
          description:
            "Dead-lettering happens after 60 minutes, so the 15-minute target can be missed silently for 45 minutes.",
          recommendedChange:
            "Alert when an event is undelivered after 15 minutes, separately from the dead-letter alert.",
        },
        {
          severity: "low",
          category: "edge_case",
          description:
            "Out-of-order events are listed as an edge case without an expected behavior.",
          recommendedChange:
            "Specify that consumers must handle out-of-order events, or require ordering per payment.",
        },
      ],
    },
    finalSpecification,
    reviewDecisions: [
      {
        issueIndex: 0,
        disposition: "applied",
        reason: "Added FR-007 and AC-010; the delivery worker covers FR-007.",
      },
      {
        issueIndex: 1,
        disposition: "applied",
        reason:
          "Added FR-008 and AC-011; TASK-004 now includes the 15-minute latency alert.",
      },
      {
        issueIndex: 2,
        disposition: "deferred",
        reason:
          "Ordering depends on how the consumers apply events, which the user has not described. Recorded as an open decision.",
      },
    ],
  },
};
