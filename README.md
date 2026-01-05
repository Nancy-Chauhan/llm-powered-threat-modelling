# Threat Modeling Dashboard

A self-serve threat modeling dashboard that allows teams to upload design context (PRDs, diagrams, screenshots), answer guided questions, and generate AI-powered threat models with Top 5 risks, impact scores, and mitigations.

## Features

- **Create Threat Models**: Step-by-step wizard for providing context
- **Upload Context**: Support for PRDs, architecture diagrams, and screenshots
- **Guided Questions**: Security-focused questionnaire based on STRIDE methodology
- **AI-Powered Generation**: Uses Claude to analyze context and identify threats
- **Risk Scoring**: Automated risk calculation (Likelihood × Impact)
- **Mitigations**: Actionable mitigation suggestions with priority and effort levels
- **Shareable Links**: Generate public share links for stakeholder review
- **Export**: Download as Markdown, JSON, or HTML (printable to PDF)

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Zustand, Radix UI
- **Backend**: Bun, Hono, Drizzle ORM, PostgreSQL
- **AI**: Anthropic Claude API

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Anthropic API key

### Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd threat-modeling-dashboard
   bun install
   ```

2. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```

3. **Configure environment**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env and add your ANTHROPIC_API_KEY
   ```

4. **Run database migrations**:
   ```bash
   bun run db:generate
   bun run db:migrate
   ```

5. **Start development servers**:
   ```bash
   bun run dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

## Project Structure

```
threat-modeling-dashboard/
├── packages/
│   └── shared/           # Shared types, schemas, API contracts
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand store
│   │   └── lib/          # Utilities
├── backend/              # Bun + Hono API
│   ├── src/
│   │   ├── db/           # Drizzle schema
│   │   ├── routes/       # API routes
│   │   └── services/     # Business logic
└── docker-compose.yml    # PostgreSQL
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threat-models` | List threat models |
| POST | `/api/threat-models` | Create threat model |
| GET | `/api/threat-models/:id` | Get threat model |
| PATCH | `/api/threat-models/:id` | Update threat model |
| DELETE | `/api/threat-models/:id` | Delete threat model |
| POST | `/api/threat-models/:id/generate` | Start threat generation |
| GET | `/api/threat-models/:id/generation-status` | Get generation status |
| POST | `/api/threat-models/:id/share` | Create share link |
| GET | `/api/threat-models/:id/export` | Export (format=markdown\|json\|pdf) |
| POST | `/api/threat-models/:id/files` | Upload context file |
| GET | `/api/shared/:token` | Get shared threat model |
| GET | `/api/questions` | Get guided questions |

## Scripts

```bash
# Development
bun run dev              # Start frontend + backend
bun run dev:frontend     # Start frontend only
bun run dev:backend      # Start backend only

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio

# Build
bun run build            # Build all packages
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/threat_modeling` |
| `PORT` | Backend server port | `3001` |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `PUBLIC_URL` | Base URL for share links | `http://localhost:5173` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |

## License

MIT
