<!-- GSD:project-start source:PROJECT.md -->
## Project

**MailOps**

MailOps is an Email Campaign Management SaaS built for marketers and founders who need to manage contact lists, build and send email campaigns, and understand how their audience engages with their content. It ships with open/click/reply tracking, A/B testing, drip sequences, and a template library — all on top of Supabase + Resend API, deployed to Vercel.

**Core Value:** Marketers can send targeted email campaigns and see exactly who opened, clicked, or replied — without leaving the app.

### Constraints

- **Tech Stack**: React 19 + TypeScript + Supabase + Resend — established, no changes
- **Database**: Schema for modules 1–4 is live in production with RLS; new modules (5–10) will require additional tables/migrations
- **Email Delivery**: Resend API shared domain for MVP; rate limits and deliverability apply
- **Frontend only**: No custom backend server — all business logic via Supabase (RLS + Edge Functions)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7.2 - Full application (frontend, config)
- TSX/JSX - React components
- CSS - Styling (Tailwind CSS based)
## Runtime
- Node.js v24.12.0 (development environment)
- Browser runtime (React 19 application)
- npm 11.6.2
- Lockfile: `package-lock.json` (present)
## Frameworks
- React 19.0.0 - UI framework and component library
- React Router DOM 7.5.3 - Client-side routing
- @tiptap/core 2.11.5 - Core rich text editor
- @tiptap/react 2.11.5 - React bindings for Tiptap
- @tiptap/starter-kit 2.11.5 - Pre-configured extensions
- Lucide React 0.511.0 - Icon library
- TailwindCSS 4.1.4 - Utility-first CSS framework
- @tailwindcss/vite 4.1.4 - Vite integration for Tailwind
- Vite 6.3.4 - Build tool and dev server
- @vitejs/plugin-react 4.3.4 - React plugin for Vite
- TypeScript - Static type checking
- ESLint 9.22.0 - Code linting
- @eslint/js 9.22.0 - ESLint configuration
- typescript-eslint 8.26.1 - TypeScript support for ESLint
- eslint-plugin-react-hooks 5.2.0 - React hooks linting rules
- eslint-plugin-react-refresh 0.4.19 - React refresh warnings
- autoprefixer 10.4.21 - PostCSS plugin for vendor prefixes
- globals 15.15.0 - Global variables for different environments
## Key Dependencies
- @supabase/supabase-js 2.49.4 - Backend database and auth client
- react-dom 19.0.0 - React DOM rendering
- @types/react 19.0.10 - TypeScript definitions for React
- @types/react-dom 19.0.4 - TypeScript definitions for React DOM
## Configuration
- Environment variables loaded via Vite: `import.meta.env.VITE_*`
- Key vars required (see INTEGRATIONS.md):
- `vite.config.ts` - Main Vite configuration with React plugin and Tailwind
- `tsconfig.json` - TypeScript project references configuration
- `tsconfig.app.json` - App compilation settings (ES2020, strict mode enabled)
- `tsconfig.node.json` - Node/build tool settings (ES2022)
- Target: ES2020 (app), ES2022 (build tools)
- JSX: react-jsx
- Strict: true (enabled)
- Module resolution: bundler
- noEmit: true (type checking only, Vite handles transpilation)
## Scripts
## Platform Requirements
- Node.js 24.12.0 or compatible
- npm 11.6.2
- Modern web browser with ES2020+ support
- Static site hosting (Vite outputs to `dist/`)
- Browser runtime only (no server-side code)
- Network access to Supabase backend
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: PascalCase - `Button.tsx`, `AuthContext.tsx`, `LoginPage.tsx`
- Hooks: camelCase with `use` prefix - `useAuth.ts`, `useToast()`
- Utilities/libraries: camelCase - `supabase.ts`
- Types/interfaces: In files named after their domain - `database.ts` contains `Profile` and `Database` types
- Pages: PascalCase with `Page` suffix - `LoginPage.tsx`, `DashboardPage.tsx`, `ProfilePage.tsx`
- Directories: lowercase with hyphens for multi-word - `components/ui`, `components/layout`, `pages/auth`, `pages/settings`, `pages/dashboard`
- React components: PascalCase - `export function Button()`, `export function AuthProvider()`
- Hooks: camelCase with `use` prefix - `export function useAuth()`, `export function useToast()`
- Regular functions: camelCase - `fetchProfile()`, `getInitials()`, `handleSubmit()`, `handleClickOutside()`
- Event handlers: camelCase with `handle` prefix - `handleSubmit()`, `handleSignOut()`, `handleClickOutside()`, `onOpenMobile()`, `onToggleCollapse()`
- Callbacks: camelCase - `showToast()`, `dismiss()`, `refreshProfile()`
- State variables: camelCase - `email`, `password`, `loading`, `error`, `dropdownOpen`, `sidebarCollapsed`, `mobileOpen`
- Constants (module-level): UPPER_SNAKE_CASE - `TIMEZONES`, or descriptive camelCase for object maps - `variantClasses`, `sizeClasses`, `paddingClasses`, `pageTitles`, `navItems`, `stats`
- Boolean flags: descriptive camelCase - `collapsed`, `loading`, `error`, `mobileOpen`, `dropdownOpen`, `disabled`
- Type unions: PascalCase when type aliases - `type ToastType = 'success' | 'error'`
- Interfaces: PascalCase with optional `Props` suffix for component props - `interface ButtonProps`, `interface InputProps`, `interface AuthContextValue`, `interface Profile`, `interface Database`
- Type aliases: PascalCase - `type ToastType = 'success' | 'error'`
- Enum-like objects: camelCase - `variantClasses`, `sizeClasses`, `paddingClasses`
- Generic parameters: T, K, V convention - `<T extends HTMLAttributes<HTMLDivElement>>`
## Code Style
- No Prettier or ESLint config file detected - project relies on manual formatting
- Indentation: 2 spaces (observed throughout codebase)
- Line length: No strict enforcement observed, pragmatic wrapping around 80-100 chars in component templates
- Quotes: Single quotes for string literals - `'primary'`, `'email'`, `'gray-950'`
- Semicolons: Always present - statements end with semicolons
- Trailing commas: Consistently used in multi-line objects and arrays
- ESLint: Version 9.22.0 installed with plugins for react-hooks and react-refresh
- No `.eslintrc` configuration file in root - uses default ESLint config or relies on package.json scripts
- Run with: `npm run lint`
## Import Organization
- Not detected in codebase - uses relative paths consistently
- Recommended patterns: relative paths work well for small projects, consider path aliases for larger codebases
- Default exports for components: `export default function App()` and `import App from './App'`
- Named exports for utilities and hooks: `export function useAuth()` and `import { useAuth } from '../hooks/useAuth'`
- Type imports: Uses `import type { Profile }` for type-only imports
## Error Handling
- Custom hook error throwing: Throws descriptive errors in hook context checks
- State-based error handling: Errors stored in state and displayed conditionally
- Supabase error handling: Extract error from response and handle via state
- UI error display: Conditional rendering of error alerts with styling
## Logging
- No explicit logging calls observed in production code
- Relies on React Developer Tools and browser DevTools for debugging
- Consider adding structured logging for auth flows and API errors in future
## Comments
- Minimal comments observed in codebase
- Comments used for section marking only - `{/* Public only */}`, `{/* Mobile overlay */}`, `{/* Mobile close */}`
- Code is self-documenting through clear naming and structure
- Not used in this codebase
- TypeScript interfaces and function signatures provide type documentation
## Function Design
- Small, focused functions - most functions 5-20 lines
- Components under 50 lines when possible
- Hooks under 15 lines for custom hooks
- Destructured parameters preferred for component props - `{ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }`
- Function parameters kept minimal - use object destructuring for multiple args
- Optional parameters use defaults - `variant = 'primary'`, `size = 'md'`, `loading = false`
- Explicit return types in TypeScript interfaces
- Functions return objects for multiple values - `{ error: error?.message ?? null }`
- Hooks return typed values or functions
- React components return JSX.Element implicitly
## Module Design
- Default exports: Reserved for main component per file - `export default function App()`
- Named exports: Used for utilities, hooks, and UI components - `export function Button()`, `export function useAuth()`
- Single export per file is preferred - one component/hook per file with rare exceptions
- Not used in this codebase - imports always reference specific files
- Good pattern for larger component libraries if project grows
## Tailwind CSS Patterns
- Inline Tailwind classes directly on elements
- CSS-in-JS template literals for complex class combinations
- No separate CSS files - all styling via Tailwind
- Responsive design: `hidden sm:block`, `lg:px-6`, `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
- Conditional classes: Template literals with ternary operators
- Variant objects for reusable style sets:
- Dark theme: Dark background (`bg-gray-950`, `bg-gray-900`) with gray/colored text
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client-side React application with Vite as build tool
- Cookie-based authentication via Supabase
- Context-based global state (Auth, Toast notifications)
- Routing via React Router v7 with protected routes
- Utility-first CSS with Tailwind v4
- TypeScript with strict mode enabled
## Layers
- Purpose: Render UI and handle user interactions
- Location: `src/components/`
- Contains: React components organized by responsibility
- Depends on: Hooks (useAuth, useToast), types from `src/types/`
- Used by: Page components and layout components
- Purpose: Full-page components representing different routes
- Location: `src/pages/`
- Contains: Top-level route components (LoginPage, DashboardPage, ProfilePage, etc.)
- Depends on: Presentation components, hooks, contexts
- Used by: React Router routes
- Purpose: Handle routing, authentication guards, and navigation flow
- Location: `src/routes/index.tsx` and root `src/App.tsx`
- Contains: Route definitions, ProtectedRoute and PublicOnlyRoute components
- Depends on: Hooks (useAuth), page components
- Used by: Main App component
- Purpose: Global state management and data access
- Location: `src/contexts/`, `src/hooks/`
- Contains: AuthContext (user, session, profile), ToastContext (notifications)
- Depends on: External services (supabase client)
- Used by: All components that need auth or notifications
- Purpose: External service integration and API communication
- Location: `src/lib/`
- Contains: Supabase client initialization
- Depends on: Environment variables
- Used by: Contexts and pages
- Purpose: TypeScript type definitions and interfaces
- Location: `src/types/database.ts`
- Contains: Database schemas, Profile interface, Database type mapping
- Depends on: Supabase types
- Used by: All components and contexts
## Data Flow
- Auth state (user, session, profile, loading) stored in `AuthContext`
- Toast state (active toasts) stored in `ToastContext`
- Component-level state (form inputs, UI toggles) via useState
- No Redux/Zustand — contexts are sufficient for global needs
## Key Abstractions
- Purpose: Guard routes requiring authentication
- Examples: `/dashboard`, `/contacts`, `/campaigns`, `/templates`, `/analytics`, `/settings/profile`
- Pattern: Higher-order component that checks `user` state; redirects to `/login` if unauthorized
- Purpose: Prevent authenticated users from accessing auth pages
- Examples: `/login`, `/signup`, `/forgot-password`
- Pattern: Higher-order component that checks `user` state; redirects to `/dashboard` if authenticated
- Purpose: Shared layout wrapper for authenticated pages
- Pattern: Layout component that provides Sidebar + Header + main content area
- Children: Page content rendered via `<Outlet />`
- Button: Variant-based (primary, secondary, ghost, danger), size-based (sm, md, lg), loading state
- Card: Basic card container with padding variants (sm, md, lg)
- Input: Label + icon support, error styling
- Avatar: Profile image with name fallback
- Toast: Notification overlay with auto-dismiss and manual close
- Spinner: Loading indicator with size variants
- `useAuth()`: Provides user, profile, session, loading, signIn, signUp, signOut, resetPassword, refreshProfile
- `useToast()`: Provides showToast function
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser loads application
- Responsibilities: Mount React app to DOM, initialize StrictMode
- Location: `src/App.tsx`
- Triggers: Loaded by main.tsx
- Responsibilities: Set up providers (BrowserRouter, AuthProvider, ToastProvider), define route structure
- Location: `src/contexts/AuthContext.tsx`
- Triggers: App component mounts
- Responsibilities: Initialize auth state, listen to session changes, provide auth methods
- Location: `src/components/ui/Toast.tsx`
- Triggers: App component mounts
- Responsibilities: Manage toast notifications, render toast UI
## Error Handling
- Auth methods (signIn, signUp, resetPassword) return `{ error: string | null }`
- Components check error and display in UI (e.g., LoginPage shows error box)
- Loading state prevents double-submissions during async operations
- Auth state provides `loading` flag during initial session check
- No global error boundary
- No error logging service
- No retry logic for failed requests
- Network errors not explicitly handled
## Cross-Cutting Concerns
- HTML5 form validation (required, type attributes)
- No client-side validation library
- Server-side validation via Supabase auth rules
- Supabase Auth handles session management
- JWT tokens stored in httpOnly cookies (Supabase default)
- Session checked on app load and monitored via `onAuthStateChange` listener
- Password reset via email link with redirect
- Tailwind CSS v4 with Vite plugin
- Dark theme (gray-950/900 base colors)
- Responsive design (lg: breakpoint for desktop/mobile transitions)
- Component variants via className composition (no CSS-in-JS)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
