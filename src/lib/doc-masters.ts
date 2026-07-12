import type { DocContent } from "@/lib/doc-blocks";

/**
 * The house masters, seeded into studio_doc_templates on first visit and
 * editable from there. Words carry the Greyform voice; every placeholder in
 * [brackets] is meant to be replaced before anything goes out.
 */

export const MASTERS: { kind: string; name: string; content: DocContent }[] = [
  {
    kind: "proposal",
    name: "Proposal",
    content: {
      blocks: [
        {
          type: "text",
          text: "Thank you for the conversation. This is how Greyform would approach [project], what it costs, and what happens next. It stays valid until [date, two weeks out]. After that, timelines and pricing get requoted.",
        },
        { type: "heading", text: "What we heard" },
        {
          type: "text",
          text: "[Two or three sentences playing back the problem in the client's own words. If this paragraph is wrong, nothing after it matters.]",
        },
        { type: "heading", text: "The work" },
        {
          type: "list",
          items: [
            "[Deliverable one, stated as an outcome]",
            "[Deliverable two]",
            "[Deliverable three]",
          ],
        },
        { type: "heading", text: "Not in scope" },
        {
          type: "text",
          text: "[Name the near-misses now: content writing, photography, ongoing maintenance. A sentence here saves a dispute later.]",
        },
        { type: "heading", text: "Investment" },
        {
          type: "pricing",
          currency: "NGN",
          rows: [
            {
              label: "Discovery & strategy",
              detail: "Paid on its own. What we learn here shapes everything after, and it is useful even if we stop here.",
              amount_minor: null,
            },
            { label: "Design", detail: "", amount_minor: null },
            { label: "Build & launch", detail: "", amount_minor: null },
          ],
        },
        { type: "heading", text: "Terms" },
        {
          type: "text",
          text: "Half of each phase up front, the balance on delivery of that phase. Two rounds of revisions are included per phase; further rounds are quoted as change requests before any work starts.\n\nTimelines assume feedback within three working days. Silence pauses the clock, not the queue.",
        },
        { type: "heading", text: "Next step" },
        {
          type: "text",
          text: "Reply to confirm and we send the contract and the discovery invoice together. Work starts when both come back.",
        },
      ],
    },
  },
  {
    kind: "contract",
    name: "Contract",
    content: {
      blocks: [
        {
          type: "text",
          text: "This agreement is between Greyform (KeyPass Solutions) and [client legal name] for the work described below. It is deliberately short; short gets read.",
        },
        { type: "heading", text: "Scope" },
        {
          type: "text",
          text: "The work is exactly what the attached proposal dated [date] describes. Anything beyond it goes through a written change request with its own price and timeline, approved before work starts.",
        },
        { type: "heading", text: "Money" },
        {
          type: "text",
          text: "Half of each phase before it starts, the balance on delivery of that phase. Invoices are due within seven days. Work pauses on overdue balances and resumes when they clear.",
        },
        { type: "heading", text: "Timelines" },
        {
          type: "text",
          text: "Dates in the proposal assume client feedback within three working days of each request. Delays on either side move the schedule by the same number of days.",
        },
        { type: "heading", text: "Ownership" },
        {
          type: "text",
          text: "On full payment, the client owns the final deliverables. Greyform keeps ownership of drafts, unused concepts and its own tools, and may show the finished work in its portfolio unless agreed otherwise in writing.",
        },
        { type: "heading", text: "Ending it" },
        {
          type: "text",
          text: "Either side can end this agreement in writing. Work completed to that point is billed and payable; deposits cover work already done before anything is refunded.",
        },
        { type: "heading", text: "The boring but necessary" },
        {
          type: "text",
          text: "Each side is responsible for its own taxes. Neither side is liable to the other for indirect losses. This agreement is governed by the laws of the Federal Republic of Nigeria.",
        },
        {
          type: "signatures",
          parties: [
            { label: "For Greyform", name: "Chudi Ofoma" },
            { label: "For the client", name: "" },
          ],
        },
      ],
    },
  },
  {
    kind: "onboarding",
    name: "Onboarding pack",
    content: {
      blocks: [
        { type: "heading", text: "Welcome" },
        {
          type: "text",
          text: "The contract is signed and the first invoice is in, which makes this official: we are building [project] together. This pack covers how we will work, what we need from you, and what happens at kickoff.",
        },
        { type: "heading", text: "How we work" },
        {
          type: "list",
          items: [
            "One named decision-maker on your side signs off each phase.",
            "Updates land every [Friday] on [WhatsApp]. No news is never the plan.",
            "Feedback within three working days keeps the schedule honest.",
            "Everything in writing. Calls are great; decisions from calls get confirmed in a message.",
          ],
        },
        { type: "heading", text: "Before kickoff, tell us" },
        {
          type: "questions",
          items: [
            "What does success look like twelve months after launch?",
            "Who is this for? Describe the one person it must work for.",
            "What are the three things visitors must be able to do?",
            "Which competitors or references do you admire, and what specifically about them?",
            "What should this never look or sound like?",
            "What existing materials exist (logo, colors, photos, copy)?",
            "Who supplies the words, and by when?",
            "Any hard dates this must meet (event, campaign, season)?",
            "Where does the domain live, and who has access?",
            "Anything that has burned you with designers or developers before?",
          ],
        },
        { type: "heading", text: "Kickoff agenda" },
        {
          type: "list",
          items: [
            "Walk through your answers above, thirty minutes.",
            "Agree the milestone dates and the feedback rhythm.",
            "Collect access: domain, hosting, any existing accounts.",
            "Confirm the decision-maker and the update channel.",
          ],
        },
      ],
    },
  },
  {
    kind: "brief",
    name: "Project brief",
    content: {
      blocks: [
        {
          type: "text",
          text: "What we are making, for whom, and how we will know it worked. Written after discovery, agreed before design.",
        },
        { type: "heading", text: "The problem" },
        { type: "text", text: "[One paragraph. The situation that makes this project worth money.]" },
        { type: "heading", text: "The audience" },
        { type: "text", text: "[Who must this work for, and what do they need to feel or do.]" },
        { type: "heading", text: "What it must do" },
        { type: "list", items: ["[Must one]", "[Must two]", "[Must three]"] },
        { type: "heading", text: "Voice and feel" },
        { type: "text", text: "[Adjectives, references, and the things it must never be.]" },
        { type: "heading", text: "Success measures" },
        { type: "list", items: ["[Measure one]", "[Measure two]"] },
      ],
    },
  },
  {
    kind: "handover",
    name: "Handover document",
    content: {
      blocks: [
        {
          type: "text",
          text: "Everything that is now yours, where it lives, and how to reach it. Keep this document; it is the map.",
        },
        { type: "heading", text: "What was delivered" },
        { type: "list", items: ["[Deliverable and where it lives]"] },
        { type: "heading", text: "Access transferred" },
        {
          type: "list",
          items: [
            "[Domain registrar, account email]",
            "[Hosting, account email]",
            "[Design files, link]",
          ],
        },
        { type: "heading", text: "Care and feeding" },
        {
          type: "text",
          text: "[What needs renewing and when, what to never touch, and what to do if something breaks.]\n\nIf you would rather not think about any of this, ask about a maintenance retainer.",
        },
      ],
    },
  },
];
