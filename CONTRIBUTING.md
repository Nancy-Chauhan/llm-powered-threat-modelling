# Contributing to Threat Modeling Dashboard

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding New Features](#adding-new-features)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributions from everyone regardless of experience level.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- PostgreSQL 14+
- Git
- A code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/llm-threat-modelling.git
   cd llm-threat-modelling
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/llm-threat-modelling.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your local settings:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threat_modeling_dev
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

### 3. Setup Database

```bash
# Create development database
createdb threat_modeling_dev

# Run migrations
bun run db:migrate
```

### 4. Start Development Servers

```bash
bun run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

```
llm-threat-modelling/
├── frontend/                # React frontend
│   └── src/
│       ├── components/      # UI components
│       ├── pages/           # Route pages
│       ├── store/           # Zustand store
│       └── lib/             # Utilities
├── backend/                 # Hono API server
│   └── src/
│       ├── routes/          # API endpoints
│       ├── services/        # Business logic
│       ├── llm/             # LLM providers
│       ├── storage/         # File storage
│       └── db/              # Database
├── packages/
│   └── shared/              # Shared types
└── docs/                    # Documentation
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-pdf-export` - New features
- `fix/threat-card-overflow` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/llm-provider` - Code refactoring

### Creating a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Avoid `any` types when possible
- Document complex functions with JSDoc comments

```typescript
/**
 * Generate a threat model using the configured LLM provider
 * @param threatModelId - The ID of the threat model to generate
 * @throws Error if the threat model is not found
 */
export async function generateThreatModel(threatModelId: string): Promise<void> {
  // ...
}
```

### React Components

- Use functional components with hooks
- Prefer named exports
- Keep components focused and small
- Extract reusable logic into custom hooks

```typescript
// Good
export function ThreatCard({ threat, onUpdate }: ThreatCardProps) {
  // ...
}

// Avoid
export default function(props) {
  // ...
}
```

### File Organization

- One component per file
- Co-locate related files
- Use index files for clean exports

```
components/
├── ThreatCard/
│   ├── ThreatCard.tsx
│   ├── ThreatCard.test.tsx
│   └── index.ts
```

### Styling

- Use Tailwind CSS utility classes
- Use `cn()` helper for conditional classes
- Avoid inline styles

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-primary text-primary-foreground',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

### API Routes

- Use RESTful conventions
- Validate inputs with Zod
- Return consistent error responses

```typescript
app.post('/', zValidator('json', CreateSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await service.create(body);
    return c.json(result, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create' }, 500);
  }
});
```

### Error Handling

- Use try/catch for async operations
- Provide meaningful error messages
- Log errors on the server

```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('User-friendly error message');
}
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/components/ThreatCard.test.tsx

# Run with coverage
bun test --coverage
```

### Writing Tests

```typescript
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ThreatCard } from './ThreatCard';

describe('ThreatCard', () => {
  it('renders threat title', () => {
    const threat = { id: '1', title: 'SQL Injection', severity: 'high' };
    render(<ThreatCard threat={threat} />);
    expect(screen.getByText('SQL Injection')).toBeDefined();
  });
});
```

### Test Coverage

Aim for meaningful test coverage:

- Unit tests for utilities and helpers
- Component tests for UI behavior
- Integration tests for API endpoints

## Submitting Changes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(llm): add support for Claude 3.5
fix(ui): resolve threat card overflow on mobile
docs(readme): update installation instructions
```

### Pull Request Process

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**:
   - Go to GitHub and create a PR
   - Fill out the PR template
   - Link related issues

4. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   Describe how you tested the changes

   ## Screenshots (if applicable)
   Add screenshots for UI changes

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Comments added for complex code
   - [ ] Documentation updated
   - [ ] Tests added/updated
   ```

5. **Address Review Feedback**:
   - Respond to comments
   - Make requested changes
   - Push additional commits

## Adding New Features

### Adding a New LLM Provider

1. Create provider file:
   ```typescript
   // backend/src/llm/providers/new-provider.ts
   import type { LLMProvider, LLMRequest, LLMResponse } from '../types';

   export class NewProvider implements LLMProvider {
     readonly name = 'new-provider';

     async complete(request: LLMRequest): Promise<LLMResponse> {
       // Implementation
     }

     supportsContentType(type: string): boolean {
       // Implementation
     }

     getSupportedImageTypes(): string[] {
       return ['image/jpeg', 'image/png'];
     }

     supportsPDF(): boolean {
       return false;
     }
   }
   ```

2. Add to factory:
   ```typescript
   // backend/src/llm/factory.ts
   case 'new-provider':
     return new NewProvider(config);
   ```

3. Update types:
   ```typescript
   // backend/src/llm/types.ts
   export type ProviderType = 'openai' | 'anthropic' | 'new-provider';
   ```

4. Update documentation and `.env.example`

### Adding a New Storage Provider

1. Create provider file in `backend/src/storage/providers/`
2. Implement `StorageProvider` interface
3. Add to factory in `backend/src/storage/factory.ts`
4. Update configuration types
5. Update `.env.example` with new variables

### Adding UI Components

1. Create component in `frontend/src/components/`
2. Use existing UI primitives from `components/ui/`
3. Follow existing patterns for styling
4. Add to relevant page or layout

### Adding API Endpoints

1. Add route handler in `backend/src/routes/`
2. Create Zod schema for validation
3. Add to `API_ROUTES` in shared package
4. Update README API documentation

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

Thank you for contributing!
