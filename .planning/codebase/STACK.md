# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript 5.7.2 - Full application (frontend, config)
- TSX/JSX - React components

**Secondary:**
- CSS - Styling (Tailwind CSS based)

## Runtime

**Environment:**
- Node.js v24.12.0 (development environment)
- Browser runtime (React 19 application)

**Package Manager:**
- npm 11.6.2
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 19.0.0 - UI framework and component library
- React Router DOM 7.5.3 - Client-side routing

**Editor & Rich Text:**
- @tiptap/core 2.11.5 - Core rich text editor
- @tiptap/react 2.11.5 - React bindings for Tiptap
- @tiptap/starter-kit 2.11.5 - Pre-configured extensions

**UI & Icons:**
- Lucide React 0.511.0 - Icon library
- TailwindCSS 4.1.4 - Utility-first CSS framework
- @tailwindcss/vite 4.1.4 - Vite integration for Tailwind

**Build/Dev:**
- Vite 6.3.4 - Build tool and dev server
- @vitejs/plugin-react 4.3.4 - React plugin for Vite
- TypeScript - Static type checking

**Linting & Format:**
- ESLint 9.22.0 - Code linting
- @eslint/js 9.22.0 - ESLint configuration
- typescript-eslint 8.26.1 - TypeScript support for ESLint
- eslint-plugin-react-hooks 5.2.0 - React hooks linting rules
- eslint-plugin-react-refresh 0.4.19 - React refresh warnings

**Development Utilities:**
- autoprefixer 10.4.21 - PostCSS plugin for vendor prefixes
- globals 15.15.0 - Global variables for different environments

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.49.4 - Backend database and auth client
  - Why it matters: Handles all database operations and authentication

**Supporting:**
- react-dom 19.0.0 - React DOM rendering
- @types/react 19.0.10 - TypeScript definitions for React
- @types/react-dom 19.0.4 - TypeScript definitions for React DOM

## Configuration

**Environment:**
- Environment variables loaded via Vite: `import.meta.env.VITE_*`
- Key vars required (see INTEGRATIONS.md):
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Build:**
- `vite.config.ts` - Main Vite configuration with React plugin and Tailwind
- `tsconfig.json` - TypeScript project references configuration
- `tsconfig.app.json` - App compilation settings (ES2020, strict mode enabled)
- `tsconfig.node.json` - Node/build tool settings (ES2022)

**TypeScript Compiler Options:**
- Target: ES2020 (app), ES2022 (build tools)
- JSX: react-jsx
- Strict: true (enabled)
- Module resolution: bundler
- noEmit: true (type checking only, Vite handles transpilation)

## Scripts

```bash
npm run dev                 # Start Vite dev server
npm run build              # TypeScript check + Vite production build
npm run lint               # Run ESLint
npm run preview            # Preview production build locally
```

## Platform Requirements

**Development:**
- Node.js 24.12.0 or compatible
- npm 11.6.2
- Modern web browser with ES2020+ support

**Production:**
- Static site hosting (Vite outputs to `dist/`)
- Browser runtime only (no server-side code)
- Network access to Supabase backend

---

*Stack analysis: 2026-04-12*
