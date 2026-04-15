# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Email Operations:**
- Email campaigns and contact management planned but not yet implemented
- Dashboard placeholders exist for future integration

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: Configured via `VITE_SUPABASE_URL` environment variable
  - Client: `@supabase/supabase-js` (v2.49.4)
  - Location: `src/lib/supabase.ts` - Supabase client initialization

**Database Schema:**
- `profiles` table - User profile data with fields:
  - `id` (string) - User ID, primary key
  - `workspace_id` (string) - Associated workspace
  - `full_name` (string, nullable) - User's full name
  - `avatar_url` (string, nullable) - Profile avatar URL
  - `company_name` (string, nullable) - Company affiliation
  - `timezone` (string) - User's timezone (default: UTC)
  - `created_at` (string) - Creation timestamp
  - `updated_at` (string) - Last update timestamp

**File Storage:**
- Local filesystem only for avatars referenced by URL
- Avatar URLs stored in `profiles.avatar_url`

**Caching:**
- None configured

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (managed by Supabase)
  - Implementation: JWT-based authentication
  - Client: `@supabase/supabase-js`
  - Location: `src/contexts/AuthContext.tsx`

**Authentication Methods:**
- Email + password sign-in: `supabase.auth.signInWithPassword()`
- Email + password sign-up: `supabase.auth.signUp()`
- Password reset: `supabase.auth.resetPasswordForEmail()`
- Session management: `supabase.auth.getSession()` and `onAuthStateChange()`
- Sign out: `supabase.auth.signOut()`

**Auth Context:**
- Centralized auth state in `src/contexts/AuthContext.tsx`
- Provides: `user`, `session`, `profile`, `loading` state
- Methods: `signIn()`, `signUp()`, `signOut()`, `resetPassword()`, `refreshProfile()`
- Used throughout app via `useAuth()` hook from `src/hooks/useAuth.ts`

**Protected Routes:**
- Implementation: `src/routes/index.tsx`
- `ProtectedRoute` - Requires authenticated user
- `PublicOnlyRoute` - Accessible only when not authenticated
- Redirects: Unauthenticated users to `/login`, authenticated users from auth pages to `/dashboard`

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging only (no centralized logging service)
- Error messages displayed to users via toast notifications

## CI/CD & Deployment

**Hosting:**
- Static site deployment (Vite SPA output to `dist/`)
- Buildable to any static hosting: Vercel, Netlify, AWS S3, etc.

**CI Pipeline:**
- None configured in repository

**Build Output:**
- Production build: `npm run build`
- Outputs to `dist/` directory

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Secrets location:**
- `.env` file (local development only)
- Environment variables injected at runtime by host platform
- Variables must be prefixed with `VITE_` to be exposed to client code

## Webhooks & Callbacks

**Incoming:**
- Password reset callback: Configured redirect to `/reset-password` in `src/pages/auth/ForgotPasswordPage.tsx`
- Supabase auth state change listeners in `src/contexts/AuthContext.tsx`

**Outgoing:**
- None detected

## Data Flow

**Authentication Flow:**
1. User navigates to `/login` or `/signup`
2. `LoginPage` or `SignupPage` collects credentials
3. Calls `signIn()` or `signUp()` from `useAuth()` hook
4. Methods call Supabase auth endpoints
5. On success, `AuthContext` receives auth state change event
6. Triggers profile fetch from `profiles` table
7. Updates `user`, `session`, `profile` state
8. Protected routes check auth state and redirect accordingly

**Profile Update Flow:**
1. User navigates to `/settings/profile` in `src/pages/settings/ProfilePage.tsx`
2. Form submits with optimistic UI update
3. Calls `supabase.from('profiles').update()` with new data
4. On success, calls `refreshProfile()` to sync state
5. On error, reverts optimistic changes and shows error toast

**Supabase Client Initialization:**
- Location: `src/lib/supabase.ts`
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment
- Exported as singleton `supabase` client
- Used in:
  - `src/contexts/AuthContext.tsx` - All auth operations
  - `src/pages/settings/ProfilePage.tsx` - Profile updates

## Type Definitions

**Database Types:**
- Location: `src/types/database.ts`
- `Profile` interface - Typed structure for profile records
- `Database` interface - TypeScript schema for type-safe queries

---

*Integration audit: 2026-04-12*
