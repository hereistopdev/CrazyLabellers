# Football Video Labeling Platform

A full-stack app for hiring and vetting freelancers who label 30-second football video clips for an AI football narrator project.

## Features

- **Terminology guide** — Definitions, criteria, examples, and common mistakes for all 16 event types
- **Knowledge test** — Scenario-based quiz (80% pass threshold) to verify freelancer understanding
- **Video labeling** — Frame-accurate event marking with video player, scrubbing, and event list
- **Admin dashboard** — Approve freelancers, review submissions, add assignments

### Event types

Pass, Pass Received, Recovery, Interception, Ball Out of Play, Clearance, Take on, Substitution, Block, Aerial Duel, Shot, Save, Foul, Goal, Highlight Start, Highlight End

## Tech stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose

## Prerequisites

- Node.js 18+
- MongoDB (optional for local dev — set `USE_MEMORY_DB=true` in `.env`)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev     # Starts API on http://localhost:5000 (auto-seeds on first run)
```

By default, `.env` has `USE_MEMORY_DB=true` so you **do not need MongoDB installed** for local development. The backend uses an in-memory database and seeds terminology, test questions, and sample videos automatically.

To use a real MongoDB instance instead, set `USE_MEMORY_DB=false` and configure `MONGODB_URI`.

**Default admin account** (created on first run):
- Email: `admin@labeling.local`
- Password: `admin123`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # Starts app on http://localhost:5173
```

**Important:** Start the backend first, then the frontend. The frontend proxies `/api` requests to the backend on port 5000.

## Workflow

1. **Freelancer registers** at `/register`
2. **Studies terminology** at `/terminology`
3. **Takes knowledge test** at `/test` (must score 80%+)
4. **Claims and labels videos** at `/assignments`
5. **Admin approves** qualified freelancers and reviews submissions at `/admin`

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register freelancer |
| `POST /api/auth/login` | Login |
| `GET /api/terminology` | All event definitions |
| `GET /api/tests/questions` | Random test questions |
| `POST /api/tests/submit` | Submit test answers |
| `GET /api/assignments` | List video assignments |
| `POST /api/assignments/:id/claim` | Claim assignment |
| `PUT /api/assignments/:id/labels` | Save/submit labels |
| `GET /api/admin/stats` | Admin statistics |

## Environment variables

**Backend (`backend/.env`):**

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/football-labeling
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
```

## Project structure

```
Labeling/
├── backend/
│   └── src/
│       ├── models/       # User, Terminology, TestQuestion, VideoAssignment, LabelSubmission
│       ├── routes/       # auth, terminology, tests, assignments, admin
│       └── seed/         # Terminology + test question seed data
└── frontend/
    └── src/
        ├── pages/        # Dashboard, Terminology, Test, Labeling, Admin
        └── components/   # Layout, navigation
```

## Next steps

- Upload real 30-second football clips (replace sample video URLs)
- Add video upload via Multer/S3
- Fine-tune terminology definitions with your team
- Add inter-annotator agreement scoring for quality control
