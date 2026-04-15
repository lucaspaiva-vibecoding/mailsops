# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
mailsops/
├── src/                        # Application source code
│   ├── components/             # Reusable React components
│   │   ├── layout/             # Layout components (AppLayout, Header, Sidebar)
│   │   └── ui/                 # UI primitives (Button, Card, Input, etc.)
│   ├── contexts/               # React Context providers
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # External service clients and utilities
│   ├── pages/                  # Page components organized by route
│   │   ├── auth/               # Authentication pages
│   │   ├── dashboard/          # Dashboard page
│   │   └── settings/           # Settings pages
│   ├── routes/                 # Route definitions and guards
│   ├── types/                  # TypeScript type definitions
│   ├── App.tsx                 # Root app component with routing
│   ├── main.tsx                # Entry point, DOM mount
│   ├── index.css               # Global styles (Tailwind directives)
│   └── vite-env.d.ts           # Vite env types
├── dist/                       # Build output (generated)
├── docs/                       # Documentation
├── .planning/                  # Planning documents
├── index.html                  # HTML entry point
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript root config
├── tsconfig.app.json           # TypeScript app config
├── tsconfig.node.json          # TypeScript build config
├── vite.config.ts              # Vite build config
├── .env                        # Environment variables (git-ignored)
└── .gitignore                  # Git ignore rules
```

## Directory Purposes

**src/:**
- Purpose: All application source code
- Contains: TypeScript/TSX files, CSS
- Key files: `main.tsx`, `App.tsx`, `index.css`

**src/components/:**
- Purpose: Reusable React components organized by domain
- Contains: TSX files for UI and layout
- Key files: Button, Card, Input, Avatar, Toast, AppLayout, Sidebar, Header

**src/components/layout/:**
- Purpose: Page layout container components
- Contains: AppLayout (main authenticated layout), Header (top bar with user menu), Sidebar (navigation)
- Key files: `AppLayout.tsx`, `Header.tsx`, `Sidebar.tsx`

**src/components/ui/:**
- Purpose: UI primitives and utility components
- Contains: Button, Card, Input, Avatar, Badge, Spinner, Toast
- Pattern: Each component is self-contained with prop-based customization (variants, sizes, states)
- Key files: `Button.tsx`, `Card.tsx`, `Input.tsx`, `Avatar.tsx`, `Toast.tsx`

**src/contexts/:**
- Purpose: React Context providers for global state
- Contains: AuthContext (authentication and user profile), ToastContext
- Key files: `AuthContext.tsx`

**src/hooks/:**
- Purpose: Custom React hooks that provide typed access to contexts
- Contains: `useAuth()` for authentication, `useToast()` for notifications
- Key files: `useAuth.ts`

**src/lib/:**
- Purpose: External service clients and shared utilities
- Contains: Supabase client initialization
- Key files: `supabase.ts`

**src/pages/:**
- Purpose: Full-page components representing different routes
- Contains: Page-level components organized by feature/route
- Key files: DashboardPage, LoginPage, SignupPage, ForgotPasswordPage, ProfilePage, PlaceholderPage

**src/pages/auth/:**
- Purpose: Authentication-related pages (public only)
- Contains: LoginPage, SignupPage, ForgotPasswordPage
- Key files: `LoginPage.tsx`, `SignupPage.tsx`, `ForgotPasswordPage.tsx`

**src/pages/dashboard/:**
- Purpose: Dashboard content (protected)
- Contains: DashboardPage with stats widgets
- Key files: `DashboardPage.tsx`

**src/pages/settings/:**
- Purpose: User settings pages (protected)
- Contains: ProfilePage for user profile editing
- Key files: `ProfilePage.tsx`

**src/routes/:**
- Purpose: Route guards and route component logic
- Contains: ProtectedRoute (requires auth), PublicOnlyRoute (requires no auth)
- Key files: `index.tsx`

**src/types/:**
- Purpose: TypeScript type definitions and interfaces
- Contains: Database schema types, interfaces
- Key files: `database.ts`

**dist/:**
- Purpose: Production build output (git-ignored)
- Generated: Yes (by `npm run build`)
- Committed: No

**docs/:**
- Purpose: Documentation files
- Key files: Project-specific docs

## Key File Locations

**Entry Points:**
- `index.html`: HTML entry point, loads root div and main.tsx script
- `src/main.tsx`: Mounts React app to DOM, initializes StrictMode
- `src/App.tsx`: Root component with BrowserRouter and provider setup

**Configuration:**
- `vite.config.ts`: Vite build config (React plugin, Tailwind plugin)
- `tsconfig.json`: TypeScript root config with references to app and node configs
- `tsconfig.app.json`: TypeScript app config (strict mode, ES2020 target, JSX support)
- `package.json`: Dependencies and npm scripts

**Core Logic:**
- `src/contexts/AuthContext.tsx`: Global authentication state and methods
- `src/components/ui/Toast.tsx`: Global toast notification state
- `src/lib/supabase.ts`: Supabase client initialization
- `src/routes/index.tsx`: Route guards and protection logic

**Testing:**
- No test files present (not yet implemented)

## Naming Conventions

**Files:**
- Component files: PascalCase.tsx (e.g., `LoginPage.tsx`, `Button.tsx`)
- Hook files: camelCase.ts (e.g., `useAuth.ts`)
- Type files: camelCase.ts (e.g., `database.ts`)
- Config files: lowercase with dots (e.g., `vite.config.ts`, `tsconfig.json`)
- Utility files: camelCase.ts (e.g., `supabase.ts`)

**Directories:**
- Lowercase with hyphens for multi-word directories (e.g., `src/pages/auth`, `src/components/ui`)
- Feature-based organization (e.g., `pages/auth/`, `pages/dashboard/`)
- Functional grouping by purpose (e.g., `components/layout/`, `components/ui/`)

**Components:**
- PascalCase class/function names (e.g., `function LoginPage() {}`)
- Export as named export (e.g., `export function Button() {}`)
- Prop interfaces: ComponentNameProps (e.g., `ButtonProps`, `CardProps`)

**Functions/Variables:**
- camelCase for functions and variables (e.g., `const handleSubmit`, `function fetchProfile()`)
- UPPERCASE for constants (e.g., `const navItems = [...]`)

**CSS Classes:**
- Tailwind classes exclusively (no custom CSS in component files)
- Classes applied inline via className prop
- Conditional classes via template literals and ternaries

## Where to Add New Code

**New Feature (e.g., Campaigns):**
- Primary code: `src/pages/campaigns/` for page components
- UI components: `src/components/` if reusable, or co-locate in page directory
- Context (if needed): `src/contexts/CampaignContext.tsx`
- Hooks: `src/hooks/useCampaign.ts`
- Types: `src/types/campaigns.ts`
- Routes: Add route in `src/App.tsx` under protected routes

**New Component/Module:**
- UI primitives: `src/components/ui/ComponentName.tsx`
- Layout components: `src/components/layout/ComponentName.tsx`
- Page-specific components: Co-locate in `src/pages/feature-name/`
- Export from parent directory if shared: Use index file or direct import

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (if non-service specific)
- Service clients: `src/lib/service-name.ts`
- Type definitions: `src/types/domain.ts`

**New API Integration:**
- Service client: `src/lib/api-name.ts` (similar to supabase.ts)
- Context wrapper (if global): `src/contexts/ApiNameContext.tsx`
- Hooks for context access: `src/hooks/useApiName.ts`
- Types: `src/types/api-name.ts`

**Routes:**
- Add route in `src/App.tsx` Routes component
- Public (unauth): Wrap in `<Route element={<PublicOnlyRoute />}>`
- Protected (auth required): Wrap in `<Route element={<ProtectedRoute />}>`
- Inside AppLayout: Nest under `<Route element={<AppLayout />}>`

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies (npm packages)
- Generated: Yes (by npm install)
- Committed: No

**.planning/:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD tools)
- Committed: Yes (tracks planning history)

**dist/:**
- Purpose: Production build artifacts
- Generated: Yes (by `npm run build`)
- Committed: No

**.env:**
- Purpose: Environment variables (git-ignored)
- Generated: Manual setup
- Committed: No
- Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

---

*Structure analysis: 2026-04-12*
