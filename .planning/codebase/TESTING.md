# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Status:** Not implemented

**Current State:**
- No test files in `/src` directory
- No test runner configured (Jest, Vitest, etc.)
- No testing libraries installed (React Testing Library, Enzyme, etc.)
- Package.json does not include test scripts or dependencies

**Relevant DevDependencies:**
- TypeScript: ~5.7.2
- ESLint: ^9.22.0 (for linting, not testing)
- Vite: ^6.3.4 (build tool only)

## Recommendation for Implementation

**Suggested Test Framework:**
- **Vitest** - Vite-native test runner, zero-config integration with existing Vite setup
- **React Testing Library** - Industry standard for testing React components
- **@testing-library/jest-dom** - Common assertions for DOM testing

**Configuration Pattern:**
```
// vitest.config.ts (suggested)
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

## Test File Organization

**Recommended Location:**
- Co-located pattern: `ComponentName.test.tsx` next to `ComponentName.tsx`
- Example structure:
  ```
  src/components/ui/Button.tsx
  src/components/ui/Button.test.tsx
  src/hooks/useAuth.ts
  src/hooks/useAuth.test.ts
  src/contexts/AuthContext.tsx
  src/contexts/AuthContext.test.tsx
  ```

**Naming Convention:**
- Test files: `[ModuleName].test.ts` or `[ModuleName].test.tsx`
- Spec files: Not preferred in this codebase style

**Run Commands (Once Implemented):**
```bash
npm test              # Run all tests
npm test -- --watch  # Watch mode
npm test -- --coverage  # Coverage report
```

## Test Structure

**Recommended Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render with default variant', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should apply variant classes correctly', () => {
      const { container } = render(<Button variant="danger">Delete</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-red-700')
    })
  })

  describe('interactions', () => {
    it('should call onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledOnce()
    })

    it('should disable button when loading', () => {
      render(<Button loading={true}>Submit</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Button>Accessible Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeAccessible()
    })
  })
})
```

**Patterns:**
- Setup: `beforeEach()` for test initialization and mocking
- Teardown: `afterEach()` for cleanup (automatic in Vitest)
- Assertions: Use `expect()` with descriptive matchers
- Organization: Group related tests with nested `describe()` blocks

## Mocking

**Framework:** Vitest built-in `vi` module for mocking

**Common Mock Patterns:**

```typescript
// Mock functions
const handleSubmit = vi.fn()
const handleChange = vi.fn().mockImplementation((e) => console.log(e.target.value))

// Mock modules
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

// Mock hooks
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    profile: null,
    loading: false,
    signIn: vi.fn(),
  })),
}))

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})
```

**What to Mock:**
- External API calls (Supabase, HTTP requests)
- Custom hooks that depend on context providers
- React Router hooks and navigation
- Window/Browser APIs (localStorage, crypto, etc.)

**What NOT to Mock:**
- React core functionality
- Component children and composition
- Tailwind CSS classes (test behavior, not styling)
- Simple utility functions under test
- Basic HTML elements (button, input, form)

## Fixtures and Factories

**Test Data Pattern (Recommended):**

```typescript
// src/test/fixtures/auth.ts
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
}

export const mockProfile = {
  id: 'test-user-123',
  workspace_id: 'ws-123',
  full_name: 'Test User',
  avatar_url: null,
  company_name: 'Test Company',
  timezone: 'UTC',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockAuthContext = {
  user: mockUser,
  profile: mockProfile,
  session: { user: mockUser },
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  refreshProfile: vi.fn(),
}

// Factory function
export function createMockProfile(overrides = {}) {
  return { ...mockProfile, ...overrides }
}
```

**Location:**
- `src/test/fixtures/` - Static test data
- `src/test/factories/` - Factory functions for dynamic test data
- `src/test/mocks/` - Mock implementations of services

## Coverage

**Recommended Targets (Once Implemented):**
- Lines: 70%+ for utilities and hooks
- Functions: 80%+ for public APIs
- Branches: 60%+ for complex conditional logic

**View Coverage:**
```bash
npm test -- --coverage
```

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/vite-env.d.ts',
      ],
      lines: 70,
      functions: 80,
      branches: 60,
    },
  },
})
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, components, hooks
- **Approach:** Test in isolation with mocked dependencies
- **Examples:**
  - Button component rendering with variants
  - useAuth hook context validation
  - Form validation logic
  - Avatar initials generation

**Integration Tests:**
- **Scope:** Multiple components working together
- **Approach:** Test realistic user workflows with fewer mocks
- **Examples:**
  - Login form with auth context
  - AppLayout with Sidebar and Header navigation
  - ProfilePage form submission with Supabase update
  - Toast notifications appearing after actions

**E2E Tests:**
- **Status:** Not implemented
- **Recommendation:** Consider Playwright or Cypress for future phases
- **Scope:** Full user journeys from login to data manipulation
- **Examples:**
  - Complete login workflow
  - Profile update flow
  - Navigation and routing

## Common Testing Patterns for This Codebase

**Testing Components with Props:**
```typescript
describe('Button', () => {
  it('should render with variant and size props', () => {
    render(
      <Button variant="danger" size="lg" onClick={vi.fn()}>
        Delete
      </Button>
    )
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-red-700')
    expect(button).toHaveClass('px-6')
  })
})
```

**Testing Context Hooks:**
```typescript
describe('useAuth', () => {
  it('should throw when used outside provider', () => {
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within AuthProvider')
  })

  it('should return auth context value', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )
    expect(screen.getByText(/logged in/i)).toBeInTheDocument()
  })
})

function TestComponent() {
  const { user } = useAuth()
  return <div>{user?.email}</div>
}
```

**Testing Form Submission:**
```typescript
describe('LoginPage', () => {
  it('should submit form with email and password', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({ error: null })
    vi.mock('../hooks/useAuth', () => ({
      useAuth: () => ({ signIn: mockSignIn }),
    }))

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })
})
```

**Testing Async Operations:**
```typescript
describe('ProfilePage', () => {
  it('should show loading state during save', async () => {
    const mockUpdate = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    render(<ProfilePage />)

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Updated Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByRole('button')).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })
})
```

**Testing Error Handling:**
```typescript
describe('LoginPage Error Handling', () => {
  it('should display error message on failed login', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({
      error: 'Invalid credentials',
    })

    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
})
```

## Testing Best Practices for This Codebase

1. **Test behavior, not implementation** - Test what users see and do, not how components work internally
2. **Use semantic queries** - Prefer `getByRole()`, `getByLabelText()` over `getByTestId()`
3. **Test accessibility** - Ensure components have proper ARIA attributes and keyboard navigation
4. **Mock external services** - Always mock Supabase, API calls, and authentication
5. **Keep tests focused** - One logical assertion per test
6. **Use descriptive test names** - Should read like documentation
7. **Test error states** - As important as happy paths
8. **Test async operations** - Use `waitFor()` for state updates and API calls

---

*Testing analysis: 2026-04-12*
