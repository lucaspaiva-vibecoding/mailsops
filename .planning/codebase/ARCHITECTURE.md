# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Layered SPA with Context API state management

**Key Characteristics:**
- Client-side React application with Vite as build tool
- Cookie-based authentication via Supabase
- Context-based global state (Auth, Toast notifications)
- Routing via React Router v7 with protected routes
- Utility-first CSS with Tailwind v4
- TypeScript with strict mode enabled

## Layers

**Presentation Layer (UI Components):**
- Purpose: Render UI and handle user interactions
- Location: `src/components/`
- Contains: React components organized by responsibility
- Depends on: Hooks (useAuth, useToast), types from `src/types/`
- Used by: Page components and layout components

**Page Layer:**
- Purpose: Full-page components representing different routes
- Location: `src/pages/`
- Contains: Top-level route components (LoginPage, DashboardPage, ProfilePage, etc.)
- Depends on: Presentation components, hooks, contexts
- Used by: React Router routes

**Route & Navigation Layer:**
- Purpose: Handle routing, authentication guards, and navigation flow
- Location: `src/routes/index.tsx` and root `src/App.tsx`
- Contains: Route definitions, ProtectedRoute and PublicOnlyRoute components
- Depends on: Hooks (useAuth), page components
- Used by: Main App component

**Context & State Management Layer:**
- Purpose: Global state management and data access
- Location: `src/contexts/`, `src/hooks/`
- Contains: AuthContext (user, session, profile), ToastContext (notifications)
- Depends on: External services (supabase client)
- Used by: All components that need auth or notifications

**Service Layer:**
- Purpose: External service integration and API communication
- Location: `src/lib/`
- Contains: Supabase client initialization
- Depends on: Environment variables
- Used by: Contexts and pages

**Type Layer:**
- Purpose: TypeScript type definitions and interfaces
- Location: `src/types/database.ts`
- Contains: Database schemas, Profile interface, Database type mapping
- Depends on: Supabase types
- Used by: All components and contexts

## Data Flow

**Authentication Flow:**

1. User loads application → AuthProvider initializes
2. AuthProvider calls `supabase.auth.getSession()` on mount
3. Session data updates user, session, and profile state
4. `useAuth()` hook exposes auth state to components
5. ProtectedRoute checks `user` state to render or redirect
6. PublicOnlyRoute prevents authenticated users from accessing login/signup pages

**Toast Notification Flow:**

1. Component calls `showToast(message, type)` via `useToast()` hook
2. ToastProvider generates UUID and adds toast to state array
3. Toast component renders with auto-dismiss timer (4000ms)
4. User can manually dismiss by clicking X button
5. Dismissed toast removed from state array

**Profile Loading Flow:**

1. Session obtained from Supabase auth
2. Profile fetched from `profiles` table using user ID
3. Profile cached in AuthContext state
4. Profile accessible via `useAuth().profile` in any component

**State Management:**
- Auth state (user, session, profile, loading) stored in `AuthContext`
- Toast state (active toasts) stored in `ToastContext`
- Component-level state (form inputs, UI toggles) via useState
- No Redux/Zustand — contexts are sufficient for global needs

## Key Abstractions

**ProtectedRoute:**
- Purpose: Guard routes requiring authentication
- Examples: `/dashboard`, `/contacts`, `/campaigns`, `/templates`, `/analytics`, `/settings/profile`
- Pattern: Higher-order component that checks `user` state; redirects to `/login` if unauthorized

**PublicOnlyRoute:**
- Purpose: Prevent authenticated users from accessing auth pages
- Examples: `/login`, `/signup`, `/forgot-password`
- Pattern: Higher-order component that checks `user` state; redirects to `/dashboard` if authenticated

**AppLayout:**
- Purpose: Shared layout wrapper for authenticated pages
- Pattern: Layout component that provides Sidebar + Header + main content area
- Children: Page content rendered via `<Outlet />`

**UI Component System:**
- Button: Variant-based (primary, secondary, ghost, danger), size-based (sm, md, lg), loading state
- Card: Basic card container with padding variants (sm, md, lg)
- Input: Label + icon support, error styling
- Avatar: Profile image with name fallback
- Toast: Notification overlay with auto-dismiss and manual close
- Spinner: Loading indicator with size variants

**Authentication Hooks:**
- `useAuth()`: Provides user, profile, session, loading, signIn, signUp, signOut, resetPassword, refreshProfile
- `useToast()`: Provides showToast function

## Entry Points

**main.tsx:**
- Location: `src/main.tsx`
- Triggers: Browser loads application
- Responsibilities: Mount React app to DOM, initialize StrictMode

**App.tsx:**
- Location: `src/App.tsx`
- Triggers: Loaded by main.tsx
- Responsibilities: Set up providers (BrowserRouter, AuthProvider, ToastProvider), define route structure

**AuthProvider:**
- Location: `src/contexts/AuthContext.tsx`
- Triggers: App component mounts
- Responsibilities: Initialize auth state, listen to session changes, provide auth methods

**ToastProvider:**
- Location: `src/components/ui/Toast.tsx`
- Triggers: App component mounts
- Responsibilities: Manage toast notifications, render toast UI

## Error Handling

**Strategy:** Error messages returned from async operations; components handle display

**Patterns:**
- Auth methods (signIn, signUp, resetPassword) return `{ error: string | null }`
- Components check error and display in UI (e.g., LoginPage shows error box)
- Loading state prevents double-submissions during async operations
- Auth state provides `loading` flag during initial session check

**Missing:**
- No global error boundary
- No error logging service
- No retry logic for failed requests
- Network errors not explicitly handled

## Cross-Cutting Concerns

**Logging:** None implemented. No logging framework present.

**Validation:**
- HTML5 form validation (required, type attributes)
- No client-side validation library
- Server-side validation via Supabase auth rules

**Authentication:**
- Supabase Auth handles session management
- JWT tokens stored in httpOnly cookies (Supabase default)
- Session checked on app load and monitored via `onAuthStateChange` listener
- Password reset via email link with redirect

**Styling:**
- Tailwind CSS v4 with Vite plugin
- Dark theme (gray-950/900 base colors)
- Responsive design (lg: breakpoint for desktop/mobile transitions)
- Component variants via className composition (no CSS-in-JS)

---

*Architecture analysis: 2026-04-12*
