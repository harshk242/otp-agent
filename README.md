# OpenTargets Agent - TypeScript Convex Backend

AI-powered drug target triage platform built with Convex and React.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (TypeScript)                     │
│  - User interface                                            │
│  - Convex React hooks (useQuery, useMutation, useAction)     │
│  - Automatic real-time updates                               │
│  - Type-safe (generated from backend)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ Convex Client (WebSocket)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Convex Backend (TypeScript)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Actions (agent logic)                                  │ │
│  │ - runTriage()                                          │ │
│  │ - getSafetyProfile()                                   │ │
│  │ - analyzeCompetitors()                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Built-in Database (NoSQL)                              │ │
│  │ - geneLists table                                      │ │
│  │ - triageJobs table                                     │ │
│  │ - targetReports table                                  │ │
│  │ - triageReports table                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Target Triage**: Analyze multiple drug target candidates for a disease
- **Safety Investigation**: Deep investigation of safety signals using ChEMBL and PubMed
- **Competitor Analysis**: Clinical trial landscape analysis from ClinicalTrials.gov
- **Scoring System**: Multi-dimensional scoring (genetic evidence, tractability, safety, competition)
- **Decision Engine**: Automated verdicts (GO, GO_WITH_CAUTION, INVESTIGATE_FURTHER, NO_GO)
- **Real-time Updates**: Live progress tracking via Convex subscriptions

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Convex (serverless functions + database)
- **Data Sources**:
  - Open Targets Platform (GraphQL)
  - ChEMBL (REST API)
  - PubMed (E-utilities)
  - ClinicalTrials.gov (REST API)

## Project Structure

```
otp-agent/
├── convex/                    # Convex backend
│   ├── schema.ts              # Database schema
│   ├── agent.ts               # Main agent actions
│   ├── triage.ts              # Triage mutations/queries
│   ├── geneLists.ts           # Gene list CRUD
│   └── lib/                   # Shared library
│       ├── types.ts           # TypeScript types
│       ├── clients/           # API clients
│       │   ├── otpClient.ts   # Open Targets Platform
│       │   ├── chemblClient.ts
│       │   ├── pubmedClient.ts
│       │   └── ctgovClient.ts
│       ├── tools/             # Agentic tools
│       │   ├── safetyInvestigator.ts
│       │   └── competitorAnalyzer.ts
│       └── scoring/           # Scoring logic
│           ├── scorer.ts
│           └── decisionEngine.ts
├── src/                       # React frontend
│   ├── components/
│   │   ├── TriageForm.tsx
│   │   ├── TriageResults.tsx
│   │   └── TargetReportDetail.tsx
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- Bun (recommended) or npm

### Installation

```bash
# Install dependencies
bun install

# or with npm
npm install
```

### Development

```bash
# Start Convex backend (in one terminal)
npx convex dev

# Start frontend (in another terminal)
bun run dev:frontend

# or
npm run dev:frontend
```

### Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

The `VITE_CONVEX_URL` will be automatically populated when you run `npx convex dev`.

### Deployment

```bash
# Deploy to Convex cloud
npx convex deploy

# Build frontend
bun run build

# Deploy frontend to your hosting provider (Vercel, Netlify, etc.)
```

## API Reference

### Actions

#### `runTriage`
Run full triage analysis for a list of genes.

```typescript
const result = await runTriage({
  genes: [{ symbol: "PNPLA3" }, { symbol: "TM6SF2" }],
  diseaseId: "EFO_0001422",
  diseaseName: "Non-alcoholic fatty liver disease"
});
```

#### `triageTarget`
Analyze a single target.

```typescript
const result = await triageTarget({
  geneSymbol: "PNPLA3",
  diseaseId: "EFO_0001422",
  diseaseName: "Non-alcoholic fatty liver disease"
});
```

#### `getSafetyProfile`
Get comprehensive safety profile for a target.

```typescript
const profile = await getSafetyProfile({
  geneSymbol: "PNPLA3"
});
```

#### `analyzeCompetitors`
Analyze competitive landscape.

```typescript
const analysis = await analyzeCompetitors({
  geneSymbol: "PNPLA3",
  diseaseId: "EFO_0001422",
  diseaseName: "Non-alcoholic fatty liver disease"
});
```

## Scoring System

### Composite Score
```
composite = genetic_evidence × 0.35 +
            tractability × 0.25 +
            (1 - safety_risk) × 0.25 +
            (1 - competitive_landscape) × 0.15
```

### Verdict Thresholds
- **GO**: Composite ≥ 0.65, no caution flags
- **GO_WITH_CAUTION**: Composite ≥ 0.45 with caution flags
- **INVESTIGATE_FURTHER**: Composite ≥ 0.25 with investigation needs
- **NO_GO**: Critical safety signals or very low scores

## License

MIT
