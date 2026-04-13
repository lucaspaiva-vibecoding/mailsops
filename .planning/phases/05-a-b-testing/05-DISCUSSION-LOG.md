# Phase 5: A/B Testing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 05-a-b-testing
**Areas discussed:** Data model for variants, UX entry point & editor, Split model & hold-back, Results view placement

---

## Data model for variants

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling campaigns | One parent campaign (type=ab_test) + two child campaign rows. Reuses all existing delivery machinery. Requires campaign_type + parent_campaign_id columns via migration. | ✓ |
| New ab_test_variants table | Dedicated table with variant_label, subject, body. Cleanest schema but requires migration and all analytics become A/B-aware. | |
| JSONB on settings field | Variant B stored in campaigns.settings JSONB. No new tables but recipient assignment and stats become complex. | |

**User's choice:** Sibling campaigns
**Notes:** Chosen for maximum reuse of existing delivery infrastructure.

---

### Migration approach (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| New migration | Add campaign_type TEXT and parent_campaign_id UUID via new migration file. Clean, reversible, follows existing pattern. | ✓ |
| JSONB hybrid | Store campaign_type in settings JSONB, parent_campaign_id as real column. | |

**User's choice:** New migration

---

## UX entry point & editor

| Option | Description | Selected |
|--------|-------------|----------|
| Separate 'New A/B Test' button | Distinct button on CampaignsPage, dedicated builder route. Clearest mental model. | ✓ |
| Toggle inside CampaignBuilderPage | Enable A/B mode toggle in existing builder. Less navigation but existing builder is already complex. | |
| Duplicate + link | Duplicate a campaign and link as variant. Awkward UX. | |

**User's choice:** Separate 'New A/B Test' button on CampaignsPage

---

### What differs per variant

| Option | Description | Selected |
|--------|-------------|----------|
| Subject AND body independently | Each variant has its own subject + body. Most flexible. Matches ABTS-01. | ✓ |
| Subject only | Body shared, only subject differs. Most common but limited. | |
| Body only | Subject shared, only body differs. Less common. | |

**User's choice:** Subject AND body, independently

---

### Builder layout for two TipTap editors

| Option | Description | Selected |
|--------|-------------|----------|
| Tab strip: Variant A / Variant B | Shared settings above, tab strip below. Compact, familiar. | ✓ |
| Side-by-side columns | Both variants visible at once. Editors become narrow on standard screens. | |
| Stacked vertically | Variant A then B, long page. User loses context while scrolling. | |

**User's choice:** Tab strip

---

## Split model & hold-back

| Option | Description | Selected |
|--------|-------------|----------|
| Three-group with hold-back | User sets test %. Half to A, half to B, remainder held back for winner. Classic A/B model. | ✓ |
| Two-group, no hold-back | Split covers 100% of contacts. No hold-back. Contradicts ABTS-04. | |

**User's choice:** Three-group split with hold-back

---

### Split UI

| Option | Description | Selected |
|--------|-------------|----------|
| Single 'test group size' input | One number; UI shows A%, B%, hold-back%. Default 40%. | ✓ |
| Two independent inputs | User sets A% and B% separately. Requires validation. | |

**User's choice:** Single test group size input/slider

---

## Results view placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated A/B results route | /campaigns/:id/ab-results. Side-by-side stats, Send winner button. CampaignAnalyticsPage unchanged. | ✓ |
| Extended CampaignAnalyticsPage | A/B section added to existing analytics page conditionally. Less navigation, more conditional complexity. | |
| Inline in CampaignsPage | Expandable row in list. Limited space for comparison. | |

**User's choice:** Dedicated A/B results route

---

### Winner send flow

| Option | Description | Selected |
|--------|-------------|----------|
| 'Send winner' button + confirm prompt | Immediate send to hold-back group. Confirm before sending. | ✓ |
| Winner can also be scheduled | Optional scheduling after picking winner. More flexible but adds complexity. | |

**User's choice:** Immediate 'Send winner' button with confirm prompt

---

## Claude's Discretion

- Exact route structure for A/B test builder
- How hold-back group contacts are stored until winner is sent
- RLS policy approach for new columns
- Loading states, empty states, error handling
- Whether to show quick A/B stats in CampaignsPage list row

## Deferred Ideas

None
