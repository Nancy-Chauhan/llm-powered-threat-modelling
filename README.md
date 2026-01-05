# Threat Modeling Dashboard

A self-serve threat modeling platform that uses LLMs to analyze system designs and generate comprehensive security threat assessments using the STRIDE methodology.

## Features

- **JIRA Integration**: Import JIRA tickets with comments, links, and attachments as context
- **Upload Context**: Support for PRDs, architecture diagrams, screenshots, and text files
- **LLM-Powered Analysis**: Automatic threat generation using OpenAI or Anthropic
- **STRIDE Methodology**: Threats categorized by Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege
- **Risk Scoring**: Likelihood × Impact scoring with severity classification
- **Mitigations**: Actionable remediation steps with priority and effort estimates
- **Shareable Reports**: Generate public share links for stakeholders
- **Export Options**: Markdown and JSON export formats

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Zustand |
| **Backend** | Bun, Hono, TypeScript, Drizzle ORM |
| **Database** | PostgreSQL |
| **LLM Providers** | OpenAI (GPT-4o), Anthropic (Claude) |
| **Storage** | Local filesystem or S3-compatible |

## Prerequisites

- [Bun](https://bun.sh/) v1.0+
- PostgreSQL 14+
- OpenAI or Anthropic API key

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd llm-threat-modelling
bun install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your settings:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threat_modeling

# LLM Provider ('openai' or 'anthropic')
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Or for Anthropic
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### 3. Setup Database

```bash
# Create database
createdb threat_modeling

# Option 1: Run migrations (recommended for production)
bun run db:migrate

# Option 2: Push schema directly (faster for development)
bun run db:push
```

> **Note**: If migrations fail due to partial state, use `bun run db:push` to sync the schema directly.

### 4. Start Development

```bash
bun run dev
```

This starts both:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## Project Structure

```
llm-threat-modelling/
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── store/           # Zustand state management
│   │   └── lib/             # Utilities
│   └── package.json
├── backend/                 # Hono API server
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── llm/             # LLM provider abstraction
│   │   ├── storage/         # File storage abstraction
│   │   └── db/              # Database schema & connection
│   ├── drizzle/             # SQL migrations
│   └── package.json
├── packages/
│   └── shared/              # Shared types & schemas
└── package.json             # Workspace root
```

## Usage

### Creating a Threat Model

1. Click **"New Model"** from the dashboard
2. Enter project name and system description
3. Upload relevant files (PRDs, diagrams, screenshots)
4. Click **"Generate Threat Model"**
5. Review generated threats and mitigations

### Supported File Types

| Type | Extensions | Notes |
|------|------------|-------|
| Images | PNG, JPG, GIF, WebP | Architecture diagrams, screenshots |
| Documents | PDF | PRDs, design docs (Anthropic only) |
| Text | TXT, MD, JSON | Requirements, configs |

### Sharing Reports

1. Open a completed threat model
2. Click **"Share"** to generate a public link
3. Share the URL with stakeholders (read-only access)

### Exporting

- **Markdown**: Human-readable report format
- **JSON**: Machine-readable for integrations

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI) |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Anthropic) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `PUBLIC_URL` | `http://localhost:5173` | Frontend URL for share links |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model to use |
| `STORAGE_PROVIDER` | `local` | `local` or `s3` |
| `UPLOAD_DIR` | `./uploads` | Local storage directory |
| `S3_BUCKET` | - | S3 bucket name |
| `S3_REGION` | - | AWS region |

### JIRA Integration (Optional)

| Variable | Description |
|----------|-------------|
| `JIRA_HOST` | JIRA instance URL (e.g., `https://company.atlassian.net`) |
| `JIRA_EMAIL` | Email address for JIRA API authentication |
| `JIRA_API_TOKEN` | JIRA API token ([Generate here](https://id.atlassian.com/manage-profile/security/api-tokens)) |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start frontend and backend in development |
| `bun run build` | Build for production |
| `bun run db:migrate` | Run database migrations |
| `bun run db:generate` | Generate migrations from schema |
| `bun run db:push` | Push schema directly to database (faster for development) |
| `bun run db:drop` | Drop database tables |
| `bun run db:studio` | Open Drizzle Studio |

## API Endpoints

### Threat Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threat-models` | List all models |
| POST | `/api/threat-models` | Create new model |
| GET | `/api/threat-models/:id` | Get model details |
| PATCH | `/api/threat-models/:id` | Update model |
| DELETE | `/api/threat-models/:id` | Delete model |
| POST | `/api/threat-models/:id/generate` | Start generation |
| GET | `/api/threat-models/:id/generation-status` | Poll status |
| POST | `/api/threat-models/:id/share` | Create share link |
| GET | `/api/threat-models/:id/export` | Export report |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/threat-models/:id/files` | Upload file |
| DELETE | `/api/threat-models/:id/files/:fileId` | Delete file |

### JIRA Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jira/status` | Check if JIRA is configured |
| POST | `/api/jira/test` | Test JIRA connection |
| POST | `/api/jira/fetch` | Fetch JIRA ticket data |
| POST | `/api/threat-models/:id/jira-tickets` | Add JIRA ticket to model |
| GET | `/api/threat-models/:id/jira-tickets` | List JIRA tickets |
| DELETE | `/api/threat-models/:id/jira-tickets/:ticketId` | Remove JIRA ticket |

### Shared Access

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shared/:token` | Get shared model |
| GET | `/api/shared/:token/export` | Export shared model |

## Documentation

- [Architecture](./docs/architecture.md) - System design and technical decisions
- [Contributing](./CONTRIBUTING.md) - How to contribute to the project

## License

MIT
