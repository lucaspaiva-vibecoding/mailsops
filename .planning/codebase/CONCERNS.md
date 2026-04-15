# Codebase Concerns

**Analysis Date:** 2026-04-12

## Error Handling Gaps

**Silent Failures in Authentication Profile Fetch:**
- Issue: `fetchProfile` in `src/contexts/AuthContext.tsx` (line 26-35) swallows database errors with `if (!error && data)` check but never logs or propagates failures
- Files: `src/contexts/AuthContext.tsx`
- Impact: If profile fetch fails, user enters app with `profile = null`, causing potential undefined reference errors in components expecting profile data. No user notification of the failure.
- Fix approach: Add explicit error logging, return error from `fetchProfile`, and optionally show toast notification for failed profile loads

**Unhandled Promise Rejection in Session Initialization:**
- Issue: `supabase.auth.getSession().then(...)` on line 42 uses `.then()` without `.catch()` handler
- Files: `src/contexts/AuthContext.tsx` (line 42-50)
- Impact: Network failures or Supabase errors during session restoration will silently fail, leaving user in indeterminate auth state
- Fix approach: Add `.catch()` handler or convert to async/await with try/catch

**Missing Error Boundary for Profile Updates:**
- Issue: Profile update error in `src/pages/settings/ProfilePage.tsx` (line 57-70) only shows error toast but doesn't prevent button from being re-clickable while update fails
- Files: `src/pages/settings/ProfilePage.tsx`
- Impact: User can trigger rapid successive update attempts; optimistic revert on error may cause state inconsistency if multiple requests conflict
- Fix approach: Add request debouncing and prevent submission if previous request is in flight

**Unauthenticated Supabase Access:**
- Issue: `src/lib/supabase.ts` creates client with `VITE_SUPABASE_ANON_KEY` - no validation that these environment variables exist at runtime
- Files: `src/lib/supabase.ts`
- Impact: If env vars are missing or empty strings, Supabase client silently fails all requests without clear error messaging
- Fix approach: Add runtime validation of env vars on app startup with user-friendly error message

## Missing Validation

**No Password Reset Route Implementation:**
- Issue: `resetPassword` in `src/contexts/AuthContext.tsx` (line 83-88) redirects to `/reset-password` endpoint, but no corresponding route exists in `src/routes/index.tsx`
- Files: `src/contexts/AuthContext.tsx`, `src/routes/index.tsx`, `src/App.tsx`
- Impact: Users clicking reset password link will receive 404 or be redirected away from actual password reset flow
- Fix approach: Implement reset password confirmation page and route

**No Minimum Password Validation Consistency:**
- Issue: Client-side validation requires 8-character password in `src/pages/auth/SignupPage.tsx` (line 27-30), but no corresponding server-side validation documented or enforced by Supabase RLS
- Files: `src/pages/auth/SignupPage.tsx`
- Impact: Determined users could bypass client validation; backend must enforce or weak passwords get created
- Fix approach: Add server-side password policy in Supabase or rely on Supabase's built-in password requirements

**No Email Validation Beyond HTML5:**
- Issue: Email inputs use `type="email"` but no custom validation for duplicate checking before signup attempt
- Files: `src/pages/auth/SignupPage.tsx`, `src/pages/auth/LoginPage.tsx`
- Impact: User sees generic Supabase error after form submission if email already registered instead of immediate feedback
- Fix approach: Add email existence check before signup submission

## Data Consistency Issues

**Profile Optimistic Update Without Rollback Safeguard:**
- Issue: In `src/pages/settings/ProfilePage.tsx` (line 51-80), optimistic update stores profile state locally, but rollback on error checks `if (optimisticProfile)` which could be null
- Files: `src/pages/settings/ProfilePage.tsx`
- Impact: If profile is null and update fails, component attempts to revert nothing, leaving UI in inconsistent state with user unsure if save happened
- Fix approach: Store original profile state before update and revert to original on error

**Race Condition in Auth State Initialization:**
- Issue: In `src/contexts/AuthContext.tsx`, `fetchProfile` is called in both initial `getSession().then()` (line 46) and auth state change listener (line 56), with no guarantee of execution order
- Files: `src/contexts/AuthContext.tsx`
- Impact: If user logs in and profile loads slowly, subsequent auth state change could trigger another redundant fetch, or stale fetch could overwrite newer profile data
- Fix approach: Add request deduplication or use AbortController for in-flight requests

## Incomplete Features

**Dashboard Statistics Show Placeholder Values:**
- Issue: `src/pages/dashboard/DashboardPage.tsx` (line 5-10) hardcodes all stats to '—' with no backend integration
- Files: `src/pages/dashboard/DashboardPage.tsx`
- Impact: Dashboard is non-functional for actual data display; users see static placeholder
- Fix approach: Implement dashboard stats queries to aggregate real campaign/contact/template data

**Five Routes Are Pure Stubs:**
- Issue: `/contacts`, `/campaigns`, `/templates`, `/analytics` all render `PlaceholderPage` with no implementation
- Files: `src/App.tsx` (lines 30-33), `src/pages/PlaceholderPage.tsx`
- Impact: Core app features are completely missing; users navigate to dead-ends
- Fix approach: Prioritize implementation of these routes in future phases

**No Role-Based Access Control:**
- Issue: No workspace membership checks; all authenticated users can access all routes and potentially all profiles via direct database queries
- Files: `src/routes/index.tsx`, `src/contexts/AuthContext.tsx`
- Impact: Workspace isolation is not enforced at application layer; relies entirely on Supabase RLS which is not visible in code
- Fix approach: Add explicit workspace membership validation and document RLS policies

## Type Safety Issues

**Unsafe Type Casting on Profile Fetch:**
- Issue: `src/contexts/AuthContext.tsx` (line 33) casts fetched data as `Profile` without validation: `setProfile(data as Profile)`
- Files: `src/contexts/AuthContext.tsx`
- Impact: If database schema returns unexpected data shape, component crash risk is high
- Fix approach: Use Zod/Yup runtime validation schema for profile data before setting state

**Database Query Returns Single Without Handling Missing Profile:**
- Issue: `.single()` on line 31 of `src/contexts/AuthContext.tsx` throws if profile doesn't exist for new user who just signed up
- Files: `src/contexts/AuthContext.tsx`
- Impact: First-time user signup succeeds but profile fetch fails, leaving user unable to use app
- Fix approach: Use `.maybeSingle()` instead or handle 404 explicitly with graceful fallback

**No UUID Validation for User IDs:**
- Issue: User ID from auth is passed directly to database queries without validation
- Files: `src/contexts/AuthContext.tsx` (line 65), `src/pages/settings/ProfilePage.tsx` (line 65)
- Impact: Malformed user ID could cause database errors or unexpected behavior
- Fix approach: Add basic UUID format validation

## Performance Concerns

**Profile Fetch on Every Auth State Change:**
- Issue: `fetchProfile` is called whenever auth state changes (line 56), even for sign-out which sets user to null
- Files: `src/contexts/AuthContext.tsx`
- Impact: Unnecessary database calls on sign-out; minor but wasteful
- Fix approach: Guard profile fetch to only execute when user actually exists

**Toast Component Uses crypto.randomUUID Without Fallback:**
- Issue: `src/components/ui/Toast.tsx` (line 22) uses `crypto.randomUUID()` with no fallback for older browsers
- Files: `src/components/ui/Toast.tsx`
- Impact: Toast notifications fail silently in IE11 or older Safari versions
- Fix approach: Add polyfill or simpler fallback UUID generation

**No Image Loading Error Handling in Avatar:**
- Issue: `src/components/ui/Avatar.tsx` displays image URLs from database without onerror handler
- Files: `src/components/ui/Avatar.tsx`
- Impact: Broken profile image URLs will show broken image icon instead of falling back to initials
- Fix approach: Add `onError` handler to fallback to initials on image load failure

## Security Considerations

**Supabase Anon Key Exposed in Browser Bundle:**
- Issue: `VITE_SUPABASE_ANON_KEY` is used directly in client code (src/lib/supabase.ts) and will be visible in built JavaScript
- Files: `src/lib/supabase.ts`
- Current mitigation: This is expected behavior for Supabase (anon key is public), but security relies entirely on RLS policies
- Risk: If RLS policies are misconfigured, unauthenticated users can access all data
- Recommendations: Audit Supabase RLS policies for all tables; ensure profile table restricts reads/updates to own user; audit public schema permissions

**No CSRF Protection on Form Submissions:**
- Issue: Profile update form lacks CSRF tokens or SameSite cookie guards
- Files: `src/pages/settings/ProfilePage.tsx`
- Current mitigation: Supabase session token required for updates, provides some protection
- Risk: Moderate - Supabase auth guards most endpoints, but custom backend APIs would need explicit CSRF protection
- Recommendations: Document that all API calls use Supabase auth tokens; add explicit Content-Type validation if custom APIs added

**No Rate Limiting on Auth Attempts:**
- Issue: Sign-in and sign-up forms have no rate limiting; user can attempt unlimited failed logins
- Files: `src/pages/auth/LoginPage.tsx`, `src/pages/auth/SignupPage.tsx`
- Current mitigation: Supabase may have server-side rate limiting but not visible in code
- Risk: Account enumeration and brute-force attacks possible
- Recommendations: Verify Supabase rate limits are enabled; consider adding client-side exponential backoff after N failures

**Password Visible in Console During Development:**
- Issue: Auth errors from Supabase may include password-related messages in browser console
- Files: `src/contexts/AuthContext.tsx`, `src/pages/auth/SignupPage.tsx`
- Current mitigation: Error messages extracted from Supabase response, not the password itself
- Risk: Low - actual password not logged, but error context could reveal auth failures
- Recommendations: Sanitize auth error messages to avoid exposing account existence; log full errors only in production monitoring service

## Testing Coverage Gaps

**No Tests for Auth Context:**
- What's not tested: Session restoration, profile fetch failures, auth state change listener, sign-in/sign-up/sign-out flows
- Files: `src/contexts/AuthContext.tsx`
- Risk: Silent authentication failures could ship to production undetected; critical auth logic has zero coverage
- Priority: High - authentication is foundational

**No Tests for Protected Routes:**
- What's not tested: Loading state display, redirect behavior for unauthenticated users, redirect behavior for authenticated users on public routes
- Files: `src/routes/index.tsx`
- Risk: Route protection could silently fail; users might see wrong pages
- Priority: High - route security is critical

**No Tests for Form Submission:**
- What's not tested: Login form submission, signup form validation, password confirmation matching, error display
- Files: `src/pages/auth/LoginPage.tsx`, `src/pages/auth/SignupPage.tsx`, `src/pages/auth/ForgotPasswordPage.tsx`
- Risk: Form logic bugs could prevent users from signing in/up
- Priority: High - core user journeys

**No Tests for Profile Updates:**
- What's not tested: Optimistic updates, error rollback, successful save confirmation, field validation
- Files: `src/pages/settings/ProfilePage.tsx`
- Risk: Profile updates could fail silently or corrupt user data
- Priority: Medium - impacts user data integrity

**No UI Component Tests:**
- What's not tested: Button loading state, spinner animation, toast appearance and dismissal, input error display, avatar fallback
- Files: `src/components/ui/`
- Risk: UI regressions could break user experience
- Priority: Medium

## Fragile Areas

**AuthContext Dependency Chain:**
- Files: `src/contexts/AuthContext.tsx`, `src/hooks/useAuth.ts`
- Why fragile: Many components depend on `useAuth` hook; any auth context changes could break components that expect profile/user/session shape; no type validation on returned data
- Safe modification: Only modify AuthContextValue interface after updating all consuming components; add integration tests before changing
- Test coverage: No tests exist for this critical path

**Profile Page Form State Synchronization:**
- Files: `src/pages/settings/ProfilePage.tsx`
- Why fragile: Multiple independent form fields synchronized with profile state via useEffect (line 40-46); if profile changes unexpectedly, form loses sync with server; optimistic update logic is complex with error recovery
- Safe modification: Add controlled form state container component; separate profile fetch from form state; add unit tests for optimistic update/rollback
- Test coverage: No tests for form logic or error handling

**Sidebar Navigation Static Mapping:**
- Files: `src/components/layout/Sidebar.tsx`
- Why fragile: Navigation items are hardcoded array (line 20-27); if routes change in App.tsx, sidebar goes out of sync; no single source of truth
- Safe modification: Extract navigation config to separate constant file; potentially generate from route definitions
- Test coverage: No tests for navigation

---

*Concerns audit: 2026-04-12*
