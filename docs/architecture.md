# Architecture

This document describes the system architecture, design decisions, and technical implementation details of the Threat Modeling Dashboard.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Schema](#database-schema)
- [LLM Provider Abstraction](#llm-provider-abstraction)
- [Storage Abstraction](#storage-abstraction)
- [Data Flow](#data-flow)
- [Security Considerations](#security-considerations)

## Overview

The Threat Modeling Dashboard is a full-stack application built with a monorepo structure using Bun workspaces. It follows a clean separation between frontend, backend, and shared code.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                      │
│                    http://localhost:5173                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼ /api/*
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Hono + Bun)                         │
│                    http://localhost:3001                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Routes        │   Services      │   Adapters                  │
│   - threat-     │   - threat-     │   - LLM (OpenAI/Anthropic)  │
│     models      │     generation  │   - Storage (Local/S3)      │
│   - shared      │   - pdf-export  │                             │
│   - questions   │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────────┐                ┌─────────────────────────┐
│    PostgreSQL       │                │   File Storage          │
│    (Drizzle ORM)    │                │   (Local/S3)            │
└─────────────────────┘                └─────────────────────────┘
```

## System Architecture

### Monorepo Structure

The project uses Bun workspaces for monorepo management:

```
llm-threat-modelling/
├── packages/
│   └── shared/              # Shared types, schemas, API contracts
├── frontend/                # React SPA
├── backend/                 # Hono API server
└── package.json             # Workspace root
```

**Why Bun Workspaces?**
- Zero configuration monorepo support
- Shared dependencies across packages
- TypeScript path resolution out of the box
- Fast installation and execution

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun | Fast startup, native TypeScript, built-in bundler |
| Frontend Framework | React 18 | Industry standard, rich ecosystem |
| Build Tool | Vite | Fast HMR, optimized production builds |
| Backend Framework | Hono | Lightweight, fast, TypeScript-first |
| ORM | Drizzle | Type-safe, SQL-like syntax, lightweight |
| State Management | Zustand | Simple, minimal boilerplate |
| Styling | Tailwind CSS | Utility-first, rapid development |
| UI Components | Radix UI | Accessible, unstyled primitives |

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/
│   ├── ui/                  # Base UI components (Button, Input, etc.)
│   ├── Layout.tsx           # App shell with navigation
│   ├── ThreatCard.tsx       # Individual threat display
│   ├── ThreatList.tsx       # Threat collection view
│   ├── SeverityBadge.tsx    # Severity indicator
│   └── StatusBadge.tsx      # Status indicator
├── pages/
│   ├── ThreatModelList.tsx  # Dashboard/home page
│   ├── CreateThreatModel.tsx # Creation wizard
│   ├── ThreatModelView.tsx  # Detail view
│   └── SharedThreatModel.tsx # Public share view
├── store/
│   └── threat-model-store.ts # Zustand store
├── lib/
│   └── utils.ts             # Utilities (cn, apiFetch)
└── main.tsx                 # App entry point
```

### State Management

Zustand store manages all application state:

```typescript
interface ThreatModelState {
  // List state
  threatModels: ThreatModelSummary[];
  total: number;
  page: number;
  isLoading: boolean;
  error: string | null;

  // Current model state
  currentModel: ThreatModel | null;
  isLoadingModel: boolean;

  // Generation state
  generationStatus: GenerationStatusResponse | null;
  isGenerating: boolean;

  // Actions
  fetchThreatModels: (page?, search?, status?) => Promise<void>;
  fetchThreatModel: (id: string) => Promise<ThreatModel | null>;
  createThreatModel: (data) => Promise<ThreatModel>;
  generateThreatModel: (id: string) => Promise<void>;
  // ... more actions
}
```

### API Communication

All API calls go through `apiFetch` utility:

```typescript
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return res.json();
}
```

### Routing

React Router v7 handles client-side routing:

```typescript
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<ThreatModelList />} />
    <Route path="new" element={<CreateThreatModel />} />
    <Route path="threat-models/:id" element={<ThreatModelView />} />
  </Route>
  <Route path="/shared/:token" element={<SharedThreatModel />} />
</Routes>
```

## Backend Architecture

### Directory Structure

```
backend/src/
├── db/
│   ├── index.ts             # Database connection
│   └── schema.ts            # Drizzle schema definitions
├── routes/
│   ├── threat-models.ts     # CRUD + generation endpoints
│   ├── shared.ts            # Public share endpoints
│   └── questions.ts         # Guided questions endpoint
├── services/
│   ├── threat-generation.ts # LLM threat generation
│   └── pdf-export.ts        # Export functionality
├── llm/
│   ├── types.ts             # Provider-agnostic interfaces
│   ├── providers/
│   │   ├── anthropic.ts     # Anthropic Claude adapter
│   │   └── openai.ts        # OpenAI GPT adapter
│   ├── factory.ts           # Provider factory
│   └── index.ts             # Exports
├── storage/
│   ├── types.ts             # Storage interfaces
│   ├── providers/
│   │   ├── local.ts         # Local filesystem adapter
│   │   └── s3.ts            # S3 adapter
│   ├── factory.ts           # Storage factory
│   └── index.ts             # Exports
└── index.ts                 # Server entry point
```

### Request Lifecycle

```
Request → Hono Router → Route Handler → Service → Database/LLM → Response
                │
                └── Middleware (CORS, Logger)
```

### Middleware Stack

```typescript
// Logging
app.use('*', logger());

// CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Static file serving (uploads)
app.use('/uploads/*', serveStatic({ root: '.' }));
```

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│    threat_models    │         │    context_files    │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │◄───────┐│ id (PK)             │
│ title               │        ││ threat_model_id (FK)│
│ description         │        │├─────────────────────┤
│ system_description  │        ││ filename            │
│ status              │        ││ original_name       │
│ threats (JSONB)     │        ││ mime_type           │
│ summary             │        ││ size                │
│ recommendations     │        ││ file_type           │
│ questions_answers   │        ││ storage_path        │
│ share_token         │        ││ extracted_text      │
│ is_public           │        ││ created_at          │
│ generation_*        │        │└─────────────────────┘
│ created_at          │        │
│ updated_at          │────────┘
└─────────────────────┘
```

### Schema Definition (Drizzle)

```typescript
export const threatModels = pgTable('threat_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  systemDescription: text('system_description'),
  status: varchar('status', { length: 50 }).default('draft').notNull(),
  threats: jsonb('threats').default([]),
  summary: text('summary'),
  recommendations: jsonb('recommendations').default([]),
  questionsAnswers: jsonb('questions_answers').default([]),
  shareToken: varchar('share_token', { length: 50 }).unique(),
  isPublic: boolean('is_public').default(false),
  generationStartedAt: timestamp('generation_started_at'),
  generationCompletedAt: timestamp('generation_completed_at'),
  generationError: text('generation_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Threat Data Structure

Threats are stored as JSONB for flexibility:

```typescript
interface Threat {
  id: string;
  title: string;
  description: string;
  category: 'spoofing' | 'tampering' | 'repudiation' |
            'information_disclosure' | 'denial_of_service' |
            'elevation_of_privilege';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  likelihood: number;  // 1-5
  impact: number;      // 1-5
  riskScore: number;   // likelihood × impact
  affectedComponents: string[];
  attackVector?: string;
  mitigations: Mitigation[];
}

interface Mitigation {
  id: string;
  description: string;
  priority: 'immediate' | 'short_term' | 'long_term';
  effort: 'low' | 'medium' | 'high';
  status: 'proposed' | 'accepted' | 'implemented' | 'rejected';
}
```

## LLM Provider Abstraction

### Design Pattern

The LLM module uses the **Adapter Pattern** to abstract away provider-specific implementations:

```
┌─────────────────────────────────────────────────────────────┐
│                    LLMProvider Interface                    │
├─────────────────────────────────────────────────────────────┤
│  + complete(request: LLMRequest): Promise<LLMResponse>      │
│  + supportsContentType(type): boolean                       │
│  + getSupportedImageTypes(): string[]                       │
│  + supportsPDF(): boolean                                   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ implements
              ┌───────────────┴───────────────┐
              │                               │
┌─────────────────────────┐     ┌─────────────────────────┐
│   AnthropicProvider     │     │     OpenAIProvider      │
├─────────────────────────┤     ├─────────────────────────┤
│ - Supports PDFs         │     │ - No PDF support        │
│ - Claude models         │     │ - GPT-4o models         │
│ - Fetches URLs→base64   │     │ - Direct URL support    │
└─────────────────────────┘     └─────────────────────────┘
```

### Provider-Agnostic Content Types

```typescript
type ContentBlock = TextContent | ImageContent | DocumentContent;

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  url: string;  // Storage URL
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

interface DocumentContent {
  type: 'document';
  url: string;  // Storage URL
  mimeType: 'application/pdf';
  filename?: string;
}
```

### Factory Pattern

```typescript
export function getDefaultProvider(): LLMProvider {
  if (!defaultProvider) {
    const config = getConfigFromEnv();
    defaultProvider = createProvider(config);
  }
  return defaultProvider;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
```

## Storage Abstraction

### Design

Similar adapter pattern for file storage:

```
┌─────────────────────────────────────────────────────────────┐
│                  StorageProvider Interface                  │
├─────────────────────────────────────────────────────────────┤
│  + upload(data, filename, options): Promise<UploadResult>   │
│  + get(key): Promise<Buffer>                                │
│  + delete(key): Promise<void>                               │
│  + exists(key): Promise<boolean>                            │
│  + getUrl(key, expiry?): Promise<string>                    │
│  + getMetadata(key): Promise<StoredFile | null>             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ implements
              ┌───────────────┴───────────────┐
              │                               │
┌─────────────────────────┐     ┌─────────────────────────┐
│  LocalStorageProvider   │     │    S3StorageProvider    │
├─────────────────────────┤     ├─────────────────────────┤
│ - Filesystem storage    │     │ - AWS S3 / compatible   │
│ - Public URLs via       │     │ - Signed URLs           │
│   static serving        │     │ - MinIO support         │
└─────────────────────────┘     └─────────────────────────┘
```

### URL-Based File Access

Files are stored and accessed via URLs rather than base64:

1. **Upload**: File → Storage Provider → Returns URL
2. **LLM Request**: URL passed in content block
3. **Provider Handling**:
   - OpenAI: Fetches URL directly
   - Anthropic: Backend fetches URL, converts to base64

## Data Flow

### Threat Model Generation Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │ Storage  │    │   LLM    │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /generate│               │               │
     │──────────────►│               │               │
     │               │               │               │
     │   202 Accept  │               │               │
     │◄──────────────│               │               │
     │               │               │               │
     │               │ Get file URLs │               │
     │               │──────────────►│               │
     │               │               │               │
     │               │     URLs      │               │
     │               │◄──────────────│               │
     │               │               │               │
     │               │    LLM Request (text + URLs)  │
     │               │──────────────────────────────►│
     │               │               │               │
     │               │          Threat Analysis      │
     │               │◄──────────────────────────────│
     │               │               │               │
     │ GET /status   │               │               │
     │──────────────►│               │               │
     │               │               │               │
     │  { status }   │               │               │
     │◄──────────────│               │               │
     │               │               │               │
```

### Share Link Flow

```
1. Owner: POST /api/threat-models/:id/share
   → Generates unique share token
   → Returns: { shareUrl, shareToken }

2. Viewer: GET /api/shared/:token
   → Validates token
   → Returns threat model (read-only)

3. Viewer: GET /api/shared/:token/export?format=markdown
   → Returns exported report
```

## Security Considerations

### Authentication & Authorization

Currently, the application does not implement authentication. For production:

- Add JWT or session-based authentication
- Implement role-based access control
- Add API rate limiting
- Validate share token expiration

### Input Validation

All API inputs are validated using Zod schemas:

```typescript
const CreateThreatModelRequestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  systemDescription: z.string().optional(),
});

app.post('/', zValidator('json', CreateThreatModelRequestSchema), async (c) => {
  const body = c.req.valid('json');
  // ...
});
```

### File Upload Security

- MIME type validation
- File size limits (10MB)
- Supported formats whitelist
- Unique filenames (nanoid)

### API Key Security

- API keys stored in environment variables
- Never exposed to frontend
- Separate keys per environment

### CORS Configuration

Restricted to known origins:

```typescript
cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
})
```

## Future Considerations

### Scalability

- Add Redis for caching and rate limiting
- Implement background job queue (BullMQ)
- Add read replicas for database
- CDN for static assets

### Features

- User authentication and teams
- Threat model versioning
- Custom threat templates
- Integration with issue trackers (Jira, Linear)
- Webhook notifications

### Performance

- Implement request caching
- Add database indexes
- Optimize LLM token usage
- Stream LLM responses
