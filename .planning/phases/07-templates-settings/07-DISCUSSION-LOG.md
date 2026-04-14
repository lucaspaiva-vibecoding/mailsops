# Phase 7: Templates & Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 07-templates-settings
**Areas discussed:** Templates page layout, Save as template flow, Settings page structure

---

## Templates page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | Cards with template name, subject, date — easy to scan | |
| Table/list | Rows with name, subject, date columns | ✓ |
| You decide | Claude picks layout | |

**User's choice:** Table/list

---

### Template row information

| Option | Description | Selected |
|--------|-------------|----------|
| Name + subject + date saved | Clean and informative | ✓ |
| Name + subject + date + body preview | Body snippet as third line | |
| Name + date only | Minimal | |

**User's choice:** Name + subject + date saved (Recommended)

---

### Template row actions

| Option | Description | Selected |
|--------|-------------|----------|
| Use template + Delete | Minimal, clean | ✓ |
| Use template + Preview + Delete | Adds body preview modal | |
| Use template + Rename + Delete | Adds in-place rename | |

**User's choice:** Use template + Delete (Recommended)

---

## Save as template flow

### Entry point location

| Option | Description | Selected |
|--------|-------------|----------|
| Campaigns list only | Row action only | |
| Campaigns list + Campaign Builder | Both locations | ✓ |
| Both + Templates page import | All locations | |

**User's choice:** Campaigns list + Campaign Builder

---

### Custom template name

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — prompt for name (modal) | Name defaults to campaign name, user confirms | ✓ |
| No — auto-name from campaign | No interaction | |

**User's choice:** Yes — prompt for template name (Recommended)

---

### Post-"Use template" destination

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign Builder (pre-filled) | Navigate directly, no modal | ✓ |
| Confirmation modal first | Show template summary before navigating | |

**User's choice:** Campaign Builder (pre-filled) — Recommended

---

## Settings page structure

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| New sections on Profile page | Add cards below existing content | |
| Separate /settings/* routes | Multiple pages with sub-nav | |
| Tabbed settings page | Profile / Workspace / Integrations tabs | ✓ |

**User's choice:** Tabbed settings page

---

### Tab structure

| Option | Description | Selected |
|--------|-------------|----------|
| Profile / Workspace / Integrations | Three tabs, well-separated concerns | ✓ |
| Profile / Workspace (merged) | Two tabs | |
| You decide | Claude picks grouping | |

**User's choice:** Profile / Workspace / Integrations (Recommended)

---

### Resend API key display

| Option | Description | Selected |
|--------|-------------|----------|
| Masked with reveal toggle | Eye icon to show/hide | |
| Always masked, replace to update | No reveal, must re-enter to change | ✓ |
| Plain text | No masking | |

**User's choice:** Always masked, replace to update

---

## Claude's Discretion

- DB schema for templates (new table vs. campaigns reuse)
- DB schema for new workspace settings fields (profiles columns vs. new table)
- Default/active tab URL routing pattern
- Empty state for Templates page
- Delete confirmation dialog design
