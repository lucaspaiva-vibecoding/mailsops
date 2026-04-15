# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- Components: PascalCase - `Button.tsx`, `AuthContext.tsx`, `LoginPage.tsx`
- Hooks: camelCase with `use` prefix - `useAuth.ts`, `useToast()`
- Utilities/libraries: camelCase - `supabase.ts`
- Types/interfaces: In files named after their domain - `database.ts` contains `Profile` and `Database` types
- Pages: PascalCase with `Page` suffix - `LoginPage.tsx`, `DashboardPage.tsx`, `ProfilePage.tsx`
- Directories: lowercase with hyphens for multi-word - `components/ui`, `components/layout`, `pages/auth`, `pages/settings`, `pages/dashboard`

**Functions:**
- React components: PascalCase - `export function Button()`, `export function AuthProvider()`
- Hooks: camelCase with `use` prefix - `export function useAuth()`, `export function useToast()`
- Regular functions: camelCase - `fetchProfile()`, `getInitials()`, `handleSubmit()`, `handleClickOutside()`
- Event handlers: camelCase with `handle` prefix - `handleSubmit()`, `handleSignOut()`, `handleClickOutside()`, `onOpenMobile()`, `onToggleCollapse()`
- Callbacks: camelCase - `showToast()`, `dismiss()`, `refreshProfile()`

**Variables:**
- State variables: camelCase - `email`, `password`, `loading`, `error`, `dropdownOpen`, `sidebarCollapsed`, `mobileOpen`
- Constants (module-level): UPPER_SNAKE_CASE - `TIMEZONES`, or descriptive camelCase for object maps - `variantClasses`, `sizeClasses`, `paddingClasses`, `pageTitles`, `navItems`, `stats`
- Boolean flags: descriptive camelCase - `collapsed`, `loading`, `error`, `mobileOpen`, `dropdownOpen`, `disabled`
- Type unions: PascalCase when type aliases - `type ToastType = 'success' | 'error'`

**Types & Interfaces:**
- Interfaces: PascalCase with optional `Props` suffix for component props - `interface ButtonProps`, `interface InputProps`, `interface AuthContextValue`, `interface Profile`, `interface Database`
- Type aliases: PascalCase - `type ToastType = 'success' | 'error'`
- Enum-like objects: camelCase - `variantClasses`, `sizeClasses`, `paddingClasses`
- Generic parameters: T, K, V convention - `<T extends HTMLAttributes<HTMLDivElement>>`

## Code Style

**Formatting:**
- No Prettier or ESLint config file detected - project relies on manual formatting
- Indentation: 2 spaces (observed throughout codebase)
- Line length: No strict enforcement observed, pragmatic wrapping around 80-100 chars in component templates
- Quotes: Single quotes for string literals - `'primary'`, `'email'`, `'gray-950'`
- Semicolons: Always present - statements end with semicolons
- Trailing commas: Consistently used in multi-line objects and arrays

**Linting:**
- ESLint: Version 9.22.0 installed with plugins for react-hooks and react-refresh
- No `.eslintrc` configuration file in root - uses default ESLint config or relies on package.json scripts
- Run with: `npm run lint`

## Import Organization

**Order:**
1. React imports - `import { useState, useContext } from 'react'`
2. React Router imports - `import { BrowserRouter, Routes } from 'react-router-dom'`
3. External library imports - `import { supabase } from '@supabase/supabase-js'`, `import { Mail, Lock } from 'lucide-react'`
4. Type imports - `import type { Profile } from '../types/database'`
5. Relative imports - `import { useAuth } from '../hooks/useAuth'`, `import { Button } from '../../components/ui/Button'`

**Path Aliases:**
- Not detected in codebase - uses relative paths consistently
- Recommended patterns: relative paths work well for small projects, consider path aliases for larger codebases

**Import syntax:**
- Default exports for components: `export default function App()` and `import App from './App'`
- Named exports for utilities and hooks: `export function useAuth()` and `import { useAuth } from '../hooks/useAuth'`
- Type imports: Uses `import type { Profile }` for type-only imports

## Error Handling

**Patterns:**
- Custom hook error throwing: Throws descriptive errors in hook context checks
  ```typescript
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  ```
- State-based error handling: Errors stored in state and displayed conditionally
  ```typescript
  const [error, setError] = useState<string | null>(null)
  if (error) {
    setError(error)
  } else {
    navigate('/dashboard')
  }
  ```
- Supabase error handling: Extract error from response and handle via state
  ```typescript
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
  ```
- UI error display: Conditional rendering of error alerts with styling
  ```typescript
  {error && (
    <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
      {error}
    </div>
  )}
  ```

## Logging

**Framework:** console - no structured logging library detected

**Patterns:**
- No explicit logging calls observed in production code
- Relies on React Developer Tools and browser DevTools for debugging
- Consider adding structured logging for auth flows and API errors in future

## Comments

**When to Comment:**
- Minimal comments observed in codebase
- Comments used for section marking only - `{/* Public only */}`, `{/* Mobile overlay */}`, `{/* Mobile close */}`
- Code is self-documenting through clear naming and structure

**JSDoc/TSDoc:**
- Not used in this codebase
- TypeScript interfaces and function signatures provide type documentation

## Function Design

**Size:**
- Small, focused functions - most functions 5-20 lines
- Components under 50 lines when possible
- Hooks under 15 lines for custom hooks

**Parameters:**
- Destructured parameters preferred for component props - `{ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }`
- Function parameters kept minimal - use object destructuring for multiple args
- Optional parameters use defaults - `variant = 'primary'`, `size = 'md'`, `loading = false`

**Return Values:**
- Explicit return types in TypeScript interfaces
- Functions return objects for multiple values - `{ error: error?.message ?? null }`
- Hooks return typed values or functions
- React components return JSX.Element implicitly

## Module Design

**Exports:**
- Default exports: Reserved for main component per file - `export default function App()`
- Named exports: Used for utilities, hooks, and UI components - `export function Button()`, `export function useAuth()`
- Single export per file is preferred - one component/hook per file with rare exceptions

**Barrel Files:**
- Not used in this codebase - imports always reference specific files
- Good pattern for larger component libraries if project grows

## Tailwind CSS Patterns

**Styling Approach:**
- Inline Tailwind classes directly on elements
- CSS-in-JS template literals for complex class combinations
- No separate CSS files - all styling via Tailwind

**Common Patterns:**
- Responsive design: `hidden sm:block`, `lg:px-6`, `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
- Conditional classes: Template literals with ternary operators
  ```typescript
  className={`${isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-400'}`}
  ```
- Variant objects for reusable style sets:
  ```typescript
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-100',
  }
  ```
- Dark theme: Dark background (`bg-gray-950`, `bg-gray-900`) with gray/colored text

---

*Convention analysis: 2026-04-12*
