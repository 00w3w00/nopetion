// Second pass across all three collections. Keep the more complete workflow
// when a draft differs mainly by wording, industry, or organizational scope.
export const templateCurationExclusions: Record<
  string,
  { keep: string; reason: string }
> = {
  "tech-positioning-evidence": {
    keep: "commercial-positioning-message-map",
    reason:
      "Both turn audience/alternatives/evidence into positioning; retain the fuller message map.",
  },
  "tech-user-problem-severity": {
    keep: "tech-feature-intake-triage",
    reason: "Problem impact classification is already part of feature intake.",
  },
  "tech-evidence-to-decision-chain": {
    keep: "tech-research-to-design-traceability",
    reason:
      "Both connect research evidence to decisions; keep the concrete design traceability workflow.",
  },
  "ops-incident-learning": {
    keep: "tech-incident-timeline-review",
    reason: "Incident timeline, impact and learning overlap.",
  },
  "ops-software-inventory": {
    keep: "tech-it-license-seat-reconciliation",
    reason:
      "Tool ownership and renewals are covered by the license/seat review.",
  },
  "ops-subscription-renewals": {
    keep: "ops-fixed-cost-review",
    reason: "Recurring cost ownership and renewal decisions overlap.",
  },
  "ops-asset-checkout": {
    keep: "tech-it-asset-lifecycle-register",
    reason:
      "Equipment assignment/return is part of the retained asset lifecycle.",
  },
  "ops-internal-service-intake": {
    keep: "tech-it-service-request-routing",
    reason:
      "Internal request classification and routing differ mostly in department wording.",
  },
  "ops-document-ownership": {
    keep: "ops-sop-review",
    reason:
      "Document ownership, review dates and updating responsibilities overlap.",
  },
  "ops-branch-handover": {
    keep: "ops-cross-team-handoff",
    reason:
      "Responsibility transfer and open-work handoff differ mainly by location.",
  },
  "ops-service-provider-contact": {
    keep: "ops-vendor-onboarding",
    reason:
      "Supplier contact and escalation details belong in the vendor onboarding record.",
  },
  "ops-partnership-fit": {
    keep: "commercial-strategic-partnership-thesis",
    reason: "Both assess strategic partner fit and assumptions.",
  },
  "ops-development-checkin": {
    keep: "ops-growth-plan",
    reason:
      "Growth goals, experiments and review conversations are covered together.",
  },
  "ops-change-readiness": {
    keep: "tech-it-change-impact-review",
    reason: "Change impact, readiness and approval checks overlap.",
  },
  "commercial-salon-aftercare-followup": {
    keep: "commercial-fitness-member-retention",
    reason: "Post-service followup and retention differ mainly by industry.",
  },
  "commercial-dental-recall-followup": {
    keep: "commercial-fitness-member-retention",
    reason:
      "Scheduled customer followup is already covered without a clinical industry variant.",
  },
  "commercial-instagram-launch-sequence": {
    keep: "commercial-product-launch-comms",
    reason:
      "Channel-specific launch sequencing fits the retained launch communication plan.",
  },
  "commercial-consulting-engagement-pipeline": {
    keep: "commercial-deal-pipeline-next-action",
    reason:
      "Consulting sales stages reuse the general opportunity pipeline workflow.",
  },
  "commercial-consulting-adoption-pulse": {
    keep: "commercial-stakeholder-adoption-map",
    reason:
      "Change adoption signals and followup fit the retained stakeholder/adoption plan.",
  },
};
