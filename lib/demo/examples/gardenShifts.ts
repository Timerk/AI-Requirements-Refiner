import type { Question } from "@/lib/schemas/analysis";
import type { ProjectSpecification } from "@/lib/schemas/specification";
import type { DemoExample } from "../types";

const identify: Question = {
  id: "Q-001",
  category: "authentication",
  question: "How should volunteers identify themselves when they claim a shift?",
  reason:
    "Determines whether the app needs accounts, emailed links, or only a name field.",
  importance: "required",
};
const cancel: Question = {
  id: "Q-002",
  category: "functionality",
  question: "Can volunteers cancel a shift they claimed, and until when?",
  reason: "Affects slot availability and how much coordinators must follow up.",
  importance: "recommended",
};
const sms: Question = {
  id: "Q-003",
  category: "integration",
  question: "Should reminders also be sent by SMS?",
  reason: "SMS adds a paid provider and phone-number handling.",
  importance: "optional",
};
const full: Question = {
  id: "Q-004",
  category: "functionality",
  question: "What should happen when a volunteer tries to claim a full shift?",
  reason: "Decides between a waitlist and a simple 'shift is full' message.",
  importance: "recommended",
};
const visibility: Question = {
  id: "Q-005",
  category: "data",
  question: "Should volunteers see who else signed up for a shift?",
  reason:
    "Volunteer names are personal data; visibility shapes privacy expectations.",
  importance: "required",
};

const draft: ProjectSpecification = {
  projectName: "Garden shift sign-up",
  goal: "Let coordinators publish weekend garden shifts and let volunteers claim, manage, and get reminded about them without creating accounts.",
  scope: [
    "Coordinators create, edit, and delete shifts",
    "Volunteers claim open slots with their name and email address",
    "A private link in the confirmation email for cancelling a claim",
    "An email reminder the day before each shift",
  ],
  outOfScope: [
    "Volunteer accounts and passwords",
    "SMS reminders",
    "Waitlists for full shifts",
    "Recurring shift templates",
  ],
  users: ["Garden coordinators", "Volunteers"],
  functionalRequirements: [
    {
      id: "FR-001",
      description:
        "Coordinators can create a shift with a date, start and end time, task type (watering or weeding), and slot count.",
    },
    {
      id: "FR-002",
      description:
        "Volunteers can claim an open slot by entering a first name, last name, and email address.",
    },
    {
      id: "FR-003",
      description:
        "After claiming, the volunteer receives a confirmation email with a private link to view or cancel the claim.",
    },
    {
      id: "FR-004",
      description:
        "Volunteers can cancel a claim through the private link until 24 hours before the shift starts.",
    },
    {
      id: "FR-005",
      description:
        "The system emails each volunteer a reminder the day before their shift.",
    },
    {
      id: "FR-006",
      description:
        "The public shift list shows remaining slots and only the first names of volunteers.",
    },
  ],
  nonFunctionalRequirements: [
    {
      id: "NFR-001",
      description:
        "Private manage links use unguessable tokens of at least 128 bits.",
    },
  ],
  technologyConstraints: [
    "Use a transactional email provider for confirmations and reminders.",
  ],
  dataRequirements: [
    "Store shifts with date, times, task type, and slot count.",
    "Store claims with first name, last name, email address, shift, and manage token.",
  ],
  acceptanceCriteria: [
    {
      id: "AC-001",
      requirementId: "FR-001",
      criterion:
        "A shift created by a coordinator appears in the public list with its slot count.",
    },
    {
      id: "AC-002",
      requirementId: "FR-002",
      criterion: "Claiming an open slot reduces the remaining slots by one.",
    },
    {
      id: "AC-003",
      requirementId: "FR-003",
      criterion:
        "A confirmation email with a working manage link arrives after claiming.",
    },
    {
      id: "AC-004",
      requirementId: "FR-004",
      criterion:
        "Cancelling 25 hours before the start frees the slot; cancelling 23 hours before is refused with an explanation.",
    },
    {
      id: "AC-005",
      requirementId: "FR-005",
      criterion:
        "A volunteer with a Saturday shift receives a reminder email on Friday.",
    },
    {
      id: "AC-006",
      requirementId: "FR-006",
      criterion:
        "The public list never shows last names or email addresses.",
    },
    {
      id: "AC-007",
      requirementId: "NFR-001",
      criterion:
        "Manage tokens come from a cryptographically secure random source and contain at least 128 bits.",
    },
  ],
  edgeCases: [
    "Two volunteers claim the last slot at the same moment.",
    "A coordinator deletes a shift that already has claims.",
  ],
  assumptions: [
    "Coordinators sign in with a shared password managed by the garden.",
  ],
  unresolvedQuestions: [],
  implementationTasks: [
    {
      id: "TASK-001",
      title: "Model shifts and claims",
      description:
        "Create the data model for shifts and claims, including manage tokens.",
      requirementIds: ["FR-001", "FR-002", "NFR-001"],
      dependencies: [],
    },
    {
      id: "TASK-002",
      title: "Coordinator shift management",
      description: "Build the create, edit, and delete screens for shifts.",
      requirementIds: ["FR-001"],
      dependencies: ["TASK-001"],
    },
    {
      id: "TASK-003",
      title: "Public shift list and claiming",
      description:
        "Show shifts with remaining slots and first names, and accept claims.",
      requirementIds: ["FR-002", "FR-006"],
      dependencies: ["TASK-001"],
    },
    {
      id: "TASK-004",
      title: "Confirmation email and manage page",
      description:
        "Send the confirmation email and build the manage page with the cancellation rule.",
      requirementIds: ["FR-003", "FR-004", "NFR-001"],
      dependencies: ["TASK-003"],
    },
    {
      id: "TASK-005",
      title: "Reminder job",
      description:
        "Schedule a daily job that emails reminders for the next day's shifts.",
      requirementIds: ["FR-005"],
      dependencies: ["TASK-001"],
    },
  ],
  implementationPrompt:
    "Build a small web app for a community garden's weekend shifts. Coordinators sign in with a shared password and manage shifts (FR-001). Volunteers claim slots without accounts (FR-002), receive a confirmation email with a private manage link (FR-003, NFR-001), may cancel until 24 hours before the shift (FR-004), and get a reminder the day before (FR-005). Show only first names publicly (FR-006). Implement TASK-001 to TASK-005 in dependency order and verify AC-001 to AC-007.",
};

const finalSpecification: ProjectSpecification = {
  ...draft,
  functionalRequirements: [
    ...draft.functionalRequirements,
    {
      id: "FR-007",
      description:
        "Claiming a full shift shows that the shift is full and creates no claim.",
    },
  ],
  acceptanceCriteria: [
    ...draft.acceptanceCriteria,
    {
      id: "AC-008",
      requirementId: "FR-007",
      criterion:
        "When the last slot is taken, a further claim attempt shows 'This shift is full' and the claim count is unchanged.",
    },
  ],
  assumptions: [],
  unresolvedQuestions: [
    "How coordinators sign in has not been decided.",
  ],
  implementationTasks: draft.implementationTasks.map((task) =>
    task.id === "TASK-003"
      ? {
          ...task,
          description:
            "Show shifts with remaining slots and first names, accept claims, and refuse claims on full shifts in the same transaction that checks capacity.",
          requirementIds: ["FR-002", "FR-006", "FR-007"],
        }
      : task,
  ),
  implementationPrompt:
    "Build a small web app for a community garden's weekend shifts. Coordinators create, edit, and delete shifts (FR-001). Volunteers claim slots with name and email, without accounts (FR-002), and full shifts refuse further claims with a clear message (FR-007). Send a confirmation email with an unguessable manage link (FR-003, NFR-001) that allows cancellation until 24 hours before the shift (FR-004), and email a reminder the day before (FR-005). Show only first names publicly (FR-006). Implement TASK-001 to TASK-005 in dependency order and verify AC-001 to AC-008. Coordinator sign-in is an open decision: ask before building TASK-002.",
};

export const gardenShiftsExample: DemoExample = {
  id: "garden-shifts",
  title: "Community garden shift sign-up",
  summary:
    "A small app with privacy and timing rules. The review removes a question and adds two.",
  idea: {
    description:
      "A sign-up page for our community garden's weekend watering and weeding shifts. Coordinators post shifts, volunteers claim them, and everyone gets a reminder the day before.",
    complexity: "small_application",
  },
  answers: {
    "Q-001":
      "Name and email only, no accounts. The confirmation email should contain a private link to manage the claim.",
    "Q-002": "Yes, until 24 hours before the shift starts.",
    "Q-004": "Show that the shift is full. No waitlist for now.",
    "Q-005":
      "Other volunteers see first names only. Coordinators see full details.",
  },
  analysis: {
    analysis: {
      understoodGoal:
        "Let community garden coordinators publish weekend volunteer shifts that volunteers can claim, with a reminder before each shift.",
      knownFacts: [
        "Coordinators create the shifts.",
        "Volunteers claim shifts.",
        "Reminders go out the day before a shift.",
        "Shifts cover weekend watering and weeding.",
      ],
      assumptions: [
        "Volunteers sign up with an email address.",
        "Each shift has a fixed number of slots.",
        "Reminders are sent by email.",
      ],
      ambiguities: [
        "How volunteers identify themselves is unspecified.",
        "Whether volunteers can cancel a claimed shift is unspecified.",
        "The reminder channel is unspecified.",
      ],
      questions: [identify, cancel, sms],
    },
    review: {
      assessment:
        "The analysis covers the core flow, but it assumes email reminders without asking, and SMS is premature for a small application. It does not cover what happens when a shift is full or who can see volunteer names.",
      challengedAssumptions: [
        "Email is assumed as the reminder channel; confirm that volunteers share an email address.",
        "A fixed slot count per shift is assumed without confirmation.",
      ],
      missingTopics: [
        "Behavior when a shift is already full",
        "Who can see the names of other volunteers",
      ],
      removedQuestionIds: ["Q-003"],
      addedQuestions: [full, visibility],
      finalQuestions: [identify, cancel, full, visibility],
    },
    questions: [identify, cancel, full, visibility],
  },
  specification: {
    draft,
    review: {
      verdict: "changes_required",
      summary:
        "The draft follows the volunteer answers closely. It needs a rule for full shifts and should not invent coordinator authentication.",
      issues: [
        {
          severity: "high",
          category: "edge_case",
          description:
            "Claiming a full shift has no requirement or acceptance criterion, although the user decided to show a 'full' message.",
          recommendedChange:
            "Add a requirement and criterion: claiming a full shift shows that it is full and creates no claim.",
        },
        {
          severity: "medium",
          category: "unsupported_assumption",
          description:
            "Coordinator sign-in with a shared password was never discussed with the user.",
          recommendedChange:
            "Move coordinator authentication to the unresolved questions instead of assuming a shared password.",
        },
        {
          severity: "low",
          category: "scope_creep",
          description:
            "Editing shifts adds work the user did not explicitly request.",
          recommendedChange: "Limit coordinator management to create and delete.",
        },
      ],
    },
    finalSpecification,
    reviewDecisions: [
      {
        issueIndex: 0,
        disposition: "applied",
        reason:
          "Added FR-007 and AC-008, and TASK-003 now checks capacity when it accepts a claim.",
      },
      {
        issueIndex: 1,
        disposition: "applied",
        reason:
          "Removed the shared-password assumption and recorded coordinator sign-in as an open decision.",
      },
      {
        issueIndex: 2,
        disposition: "rejected",
        reason:
          "Coordinators post the shifts, and correcting a posted time after a weather change is part of posting. Editing stays in scope.",
      },
    ],
  },
};
