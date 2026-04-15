# MODULE 1 PROMPT — Copy everything below this line into Claude Code

---

You are building **MailOps**, an Email Campaign Management SaaS. The Supabase database is already set up with tables and RLS policies. Your job is to scaffold the React frontend and build Module 1: Authentication.

## Project Setup

Scaffold the project in the CURRENT directory (which is the mailsops folder — don't create a subfolder). Use:

- **Vite** + React + TypeScript
- **Tailwind CSS v4**
- **React Router v7** (react-router-dom)
- **Supabase JS client** (@supabase/supabase-js)
- **Lucide React** for icons
- **TipTap** (install but don't configure yet — used later for email editor)

### Supabase Connection

Create a `.env` file with:

```
VITE_SUPABASE_URL=https://pozqnzhgqmajtaidtpkk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvenFuemhncW1hanRhaWR0cGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjU1MDUsImV4cCI6MjA5MTYwMTUwNX0.4zzsbq9s6lE7aiIQwpW4KExFobp7BtkdO9xzhPkdUs4
```

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Database Schema Context

The `profiles` table already exists in Supabase. A trigger auto-creates a profile row when a user signs up via Supabase Auth. The schema is:

```sql
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
```

RLS is enabled — users can only read/update their own profile (`id = auth.uid()`).

## What to Build

### 1. Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Button, Input, Card, etc.)
│   └── layout/          # AppLayout, Sidebar, Header
├── contexts/
│   └── AuthContext.tsx   # Auth state provider
├── hooks/
│   └── useAuth.ts       # Auth hook
├── lib/
│   └── supabase.ts      # Supabase client
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   └── ForgotPasswordPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx    # Placeholder for now
│   └── settings/
│       └── ProfilePage.tsx      # Edit profile (name, company, timezone)
├── routes/
│   └── index.tsx        # Route definitions with guards
├── types/
│   └── database.ts      # TypeScript types for all tables
├── App.tsx
└── main.tsx
```

### 2. Authentication Features

**AuthContext** should:
- Initialize by checking `supabase.auth.getSession()`
- Listen to `supabase.auth.onAuthStateChange()`
- Fetch the user's profile from `profiles` table after auth
- Expose: `user`, `profile`, `loading`, `signIn`, `signUp`, `signOut`, `resetPassword`

**Login page:**
- Email + password form
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Show error messages inline
- After login, redirect to `/dashboard`

**Signup page:**
- Full name, email, password, confirm password
- Pass `full_name` in the signup metadata: `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- After signup, show "Check your email for confirmation" message
- "Already have an account? Login" link

**Forgot password page:**
- Email input
- Calls `supabase.auth.resetPasswordForEmail()`
- Show success message

**Profile page (settings):**
- Form to edit: full_name, company_name, timezone (dropdown with common timezones)
- Reads and updates the `profiles` table
- Optimistic UI updates
- Show success toast on save

### 3. Layout & Navigation

**AppLayout** (wraps all authenticated pages):
- Collapsible sidebar on the left with navigation links:
  - Dashboard (icon: LayoutDashboard)
  - Contacts (icon: Users) — placeholder page
  - Campaigns (icon: Mail) — placeholder page
  - Templates (icon: FileText) — placeholder page
  - Analytics (icon: BarChart3) — placeholder page
  - Settings (icon: Settings) — links to profile page
- Header bar with:
  - Page title
  - User avatar/name dropdown (top right) with "Settings" and "Sign out"
- Main content area

### 4. Route Guards

- `/login`, `/signup`, `/forgot-password` — public only (redirect to `/dashboard` if already logged in)
- All other routes — protected (redirect to `/login` if not authenticated)
- Show a loading spinner while checking auth state

### 5. Design System

- **Dark mode by default** (dark background, light text)
- Use Tailwind's dark palette: `bg-gray-950` for main background, `bg-gray-900` for sidebar and cards, `bg-gray-800` for inputs/hover states
- Primary accent color: **indigo-500** (`#6366f1`)
- Text: `text-gray-100` primary, `text-gray-400` secondary
- Rounded corners (`rounded-lg`), subtle borders (`border-gray-800`)
- Smooth transitions on hover/focus
- Mobile responsive — sidebar collapses to hamburger menu on small screens

### 6. Reusable UI Components

Create these in `src/components/ui/`:
- `Button.tsx` — variants: primary, secondary, ghost, danger. Sizes: sm, md, lg. Loading state with spinner.
- `Input.tsx` — label, error message, icon support
- `Card.tsx` — container with padding and border
- `Avatar.tsx` — user avatar with initials fallback
- `Toast.tsx` — success/error notifications (simple, no external lib)
- `Spinner.tsx` — loading indicator
- `Badge.tsx` — status badges with color variants

## Important Notes

- Do NOT install any UI library (no shadcn, no MUI, no Chakra). Build all UI components from scratch with Tailwind.
- Use TypeScript strictly — define types for all props and database rows.
- Add a `.gitignore` that excludes `node_modules`, `.env`, `dist`.
- After scaffolding, run `npm install` and make sure `npm run dev` works without errors.
- The app should compile and render the login page on first load.
