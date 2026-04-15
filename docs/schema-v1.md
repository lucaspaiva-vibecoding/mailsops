# MailOps — Database Schema v1 (Modules 1–4)

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  React App  │────▶│  Supabase    │────▶│  PostgreSQL   │
│  (Vercel)   │     │  Auth + API  │     │  (RLS)        │
└──────┬──────┘     └──────────────┘     └──────────────┘
       │                                        │
       │            ┌──────────────┐            │
       └───────────▶│  Supabase    │◀───────────┘
                    │  Edge Funcs  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Resend API  │
                    └──────────────┘
```

**Key design decisions:**

1. **Workspace = user** for MVP. Each user gets an isolated workspace via `workspace_id` on every table. This makes RLS simple (`auth.uid() = workspace_id`). When we add teams in Module 10, we'll introduce a `workspaces` table and a `workspace_members` join table — the FK stays the same, just the RLS policy changes.

2. **Soft deletes everywhere.** Every table has `deleted_at`. This is critical for email platforms — you need audit trails for compliance.

3. **JSONB for flexible metadata.** Contacts have custom fields, campaigns have settings — JSONB lets us extend without migrations.

4. **UUIDs as primary keys.** Standard for Supabase, and they'll appear in tracking URLs so they shouldn't be guessable sequential IDs.

---

## Module 1: Authentication & Workspaces

Supabase Auth handles user creation. We add a `profiles` table to store workspace-level settings.

```sql
-- Extends Supabase auth.users
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    full_name       TEXT,
    avatar_url      TEXT,
    company_name    TEXT,
    timezone        TEXT DEFAULT 'UTC',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace lookups
CREATE UNIQUE INDEX idx_profiles_workspace ON public.profiles(workspace_id);
```

> **Design note:** `id` = the auth user ID, `workspace_id` = a separate UUID that all other tables reference. For now they're 1:1, but when we add team members later, multiple `profiles.id` can share the same `workspace_id`.

---

## Module 2: Contact Lists

```sql
-- Contact lists (groups of contacts)
CREATE TABLE public.contact_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),
    name            TEXT NOT NULL,
    description     TEXT,
    color           TEXT,  -- UI color tag
    contact_count   INT NOT NULL DEFAULT 0,  -- denormalized counter
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_contact_lists_workspace ON public.contact_lists(workspace_id) WHERE deleted_at IS NULL;

-- Individual contacts
CREATE TABLE public.contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),
    email           TEXT NOT NULL,
    first_name      TEXT,
    last_name       TEXT,
    company         TEXT,
    tags            TEXT[] DEFAULT '{}',        -- array of tag strings
    custom_fields   JSONB DEFAULT '{}',         -- flexible key-value pairs
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
    unsubscribed_at TIMESTAMPTZ,
    bounce_type     TEXT CHECK (bounce_type IN ('hard', 'soft')),
    bounced_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Unique email per workspace (not globally)
CREATE UNIQUE INDEX idx_contacts_email_workspace
    ON public.contacts(workspace_id, lower(email))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_workspace ON public.contacts(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_status ON public.contacts(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags) WHERE deleted_at IS NULL;

-- Many-to-many: contacts ↔ lists
CREATE TABLE public.contact_list_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_clm_unique ON public.contact_list_members(contact_list_id, contact_id);
CREATE INDEX idx_clm_contact ON public.contact_list_members(contact_id);
```

> **Why `tags TEXT[]` instead of a tags table?** For a SaaS with per-user tag sets, array + GIN index is simpler and faster for the read-heavy "filter by tag" use case. We can always extract into a normalized table later if tags grow complex.

---

## Module 3: Campaign Builder

```sql
CREATE TABLE public.campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),

    -- Basic info
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),

    -- Sender settings
    from_name       TEXT NOT NULL DEFAULT '',
    from_email      TEXT NOT NULL DEFAULT '',
    reply_to_email  TEXT,

    -- Content
    subject         TEXT NOT NULL DEFAULT '',
    preview_text    TEXT DEFAULT '',
    body_html       TEXT NOT NULL DEFAULT '',
    body_json       JSONB,  -- structured editor state (for rich text editors like TipTap)

    -- Targeting
    contact_list_id UUID REFERENCES public.contact_lists(id),
    segment_filter  JSONB,  -- e.g. {"tags": ["vip"], "status": "active"} — allows dynamic segments

    -- Scheduling
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,

    -- Stats (denormalized for fast dashboard reads)
    total_recipients INT DEFAULT 0,
    total_sent       INT DEFAULT 0,
    total_delivered  INT DEFAULT 0,
    total_opened     INT DEFAULT 0,
    total_clicked    INT DEFAULT 0,
    total_replied    INT DEFAULT 0,
    total_bounced    INT DEFAULT 0,
    total_unsubscribed INT DEFAULT 0,

    -- Metadata
    settings        JSONB DEFAULT '{}',  -- A/B test config, etc. (used in Module 7)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_workspace ON public.campaigns(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON public.campaigns(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_scheduled ON public.campaigns(scheduled_at)
    WHERE status = 'scheduled' AND deleted_at IS NULL;
```

> **Why denormalized stats on the campaign?** Calculating open rates by joining millions of event rows is expensive. We increment counters on the campaign row via triggers/edge functions when events come in. The `campaign_events` table (below) is the source of truth; these are caches for fast reads.

---

## Module 4: Email Delivery & Tracking

```sql
-- One row per recipient per campaign
CREATE TABLE public.campaign_recipients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES public.contacts(id),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),

    -- Delivery state
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'opened',
                                      'clicked', 'replied', 'bounced', 'unsubscribed', 'failed')),

    -- Resend tracking
    resend_message_id TEXT,  -- Resend's message ID for webhook correlation

    -- Personalization snapshot (so we can audit what was actually sent)
    variables       JSONB DEFAULT '{}',

    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,   -- first open
    clicked_at      TIMESTAMPTZ,   -- first click
    replied_at      TIMESTAMPTZ,
    bounced_at      TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,

    -- Tracking tokens (unique per recipient, used in pixel/redirect URLs)
    tracking_id     UUID NOT NULL DEFAULT gen_random_uuid(),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cr_campaign_contact ON public.campaign_recipients(campaign_id, contact_id);
CREATE INDEX idx_cr_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_cr_tracking ON public.campaign_recipients(tracking_id);
CREATE INDEX idx_cr_workspace ON public.campaign_recipients(workspace_id);
CREATE INDEX idx_cr_resend_id ON public.campaign_recipients(resend_message_id)
    WHERE resend_message_id IS NOT NULL;

-- Granular event log (every open, every click, etc.)
CREATE TABLE public.campaign_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),

    event_type      TEXT NOT NULL
                    CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked',
                                          'replied', 'bounced', 'unsubscribed', 'complained')),

    -- Click-specific
    link_url        TEXT,          -- original URL that was clicked
    link_index      INT,           -- position of link in email body

    -- Metadata from tracking pixel / redirect
    ip_address      INET,
    user_agent      TEXT,
    device_type     TEXT,          -- parsed: 'desktop', 'mobile', 'tablet'
    email_client    TEXT,          -- parsed: 'Gmail', 'Outlook', 'Apple Mail', etc.
    country         TEXT,          -- GeoIP lookup
    city            TEXT,

    -- Bounce specifics
    bounce_type     TEXT CHECK (bounce_type IN ('hard', 'soft')),
    bounce_reason   TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_campaign ON public.campaign_events(campaign_id);
CREATE INDEX idx_events_recipient ON public.campaign_events(recipient_id);
CREATE INDEX idx_events_workspace ON public.campaign_events(workspace_id);
CREATE INDEX idx_events_type ON public.campaign_events(campaign_id, event_type);
CREATE INDEX idx_events_created ON public.campaign_events(campaign_id, created_at);

-- Links table: tracks all links in a campaign for click analytics
CREATE TABLE public.campaign_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    original_url    TEXT NOT NULL,
    link_index      INT NOT NULL,      -- position in email body
    click_count     INT DEFAULT 0,     -- denormalized counter
    unique_clicks   INT DEFAULT 0,     -- denormalized unique counter
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_links_campaign ON public.campaign_links(campaign_id);
```

---

## Row-Level Security (RLS) — Applied to All Tables

Every table follows the same pattern:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_links ENABLE ROW LEVEL SECURITY;

-- Pattern for each table (example: contacts)
CREATE POLICY "Users can view own workspace contacts"
    ON public.contacts FOR SELECT
    USING (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own workspace contacts"
    ON public.contacts FOR INSERT
    WITH CHECK (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own workspace contacts"
    ON public.contacts FOR UPDATE
    USING (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own workspace contacts"
    ON public.contacts FOR DELETE
    USING (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

-- Same pattern applied to: contact_lists, campaigns, campaign_recipients, campaign_events, campaign_links
```

> **Profiles RLS** is slightly different: users can only see/edit their own profile row:
> `USING (id = auth.uid())`

---

## Tracking Architecture (Module 4)

```
Recipient opens email
       │
       ▼
GET /t/pixel/{tracking_id}       ──▶  Edge Function:
       │                                1. Look up recipient by tracking_id
       │                                2. Insert 'opened' event
       │                                3. Update recipient.opened_at (if first)
       │                                4. Increment campaign.total_opened
       │                                5. Return 1x1 transparent PNG
       │
Recipient clicks link
       │
       ▼
GET /t/click/{tracking_id}/{link_index}  ──▶  Edge Function:
       │                                       1. Look up recipient + link
       │                                       2. Insert 'clicked' event
       │                                       3. Update timestamps + counters
       │                                       4. 302 redirect to original URL
       │
Recipient clicks unsubscribe
       │
       ▼
GET /t/unsub/{tracking_id}       ──▶  Edge Function:
                                       1. Mark contact as 'unsubscribed'
                                       2. Insert 'unsubscribed' event
                                       3. Show confirmation page
```

These will be Supabase Edge Functions (Deno) deployed alongside the project. They use a **service_role key** (not RLS) because tracking hits come from anonymous email clients, not authenticated users.

---

## Things I'd Like Your Input On

1. **Supabase project region:** Your existing project is in `us-east-1`. Want to keep the same region for MailOps, or would `sa-east-1` (São Paulo) be better for latency given your audience?

2. **Rich text editor choice:** I'd recommend **TipTap** (built on ProseMirror) — it's the best React-native rich text editor, supports variable insertion ({{first_name}}), and stores content as JSON (which we save in `body_json`). Alternatives are Slate.js or BlockNote. Preference?

3. **Workspace model:** I kept it simple (workspace = user) for now. Should we build team support from the start, or is single-user fine for MVP?

4. **Email sending domain:** Will you have a custom domain ready for DKIM/SPF, or should we start with Resend's shared domain and add custom domain support later in Module 10?
