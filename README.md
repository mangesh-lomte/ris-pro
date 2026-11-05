# Radiology Information System (RIS) — Phase 1

An enterprise-grade, clean-architecture **Radiology Information System (RIS)** engineered for professional clinical orchestration across medical imaging workflows.

---

## 🏥 1. System Overview & Core Workflow

The RIS acts as the central clinical workflow and orchestration system, governing the end-to-end radiology pathway:

```
Online Booking / Reception 
  → Scheduling & Order Creation 
  → CT / MRI / X-ray Modality Worklist (MWL) 
  → Technologist Bedside Verification & Scan 
  → PACS Image Archive (DICOM C-STORE) 
  → Radiologist Diagnostic Reporting 
  → Final Report Electronic Attestation 
  → Patient Portal / Front Desk Delivery
```

### Architectural Separation: RIS vs. PACS
* **RIS (Workflow & Orchestration):** Governs patient master indices, orders, accession numbers, modality worklist telemetry, radiologist reporting queues, billing, and audit logs.
* **PACS (Imaging Archive):** Conceptually retains multi-frame binary DICOM pixel arrays and high-resolution viewport streaming. **DICOM binary data is intentionally kept outside the PostgreSQL relational database.**

---

## 🔑 2. Critical Domain Rule: Single Source of Truth

To eliminate clinical misidentification and medical record contamination:

1. **Persistent Patient ID (MRN):**
   * Format: `PAT-YYYY-XXXXX` (e.g., `PAT-2026-10001`)
   * Assigned once upon initial registration. Remains permanently immutable across all subsequent visits, appointments, and encounters.
   * **Date of birth is stored as source of truth; age is calculated dynamically.**

2. **Unique Accession Number:**
   * Format: `ACC-YYYYMMDD-XXXX` (e.g., `ACC-20261105-CT01`)
   * Assigned per individual imaging order.
   * Remains the **unbroken single source of truth** throughout:
     * Patient Registration $\to$ Appointment $\to$ Imaging Order $\to$ Modality Worklist $\to$ Study Telemetry $\to$ Radiologist Report $\to$ Invoice.

---

## 🛠️ 3. Technology Stack

| Layer | Technologies Selected | Purpose / Clinical Rationale |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vite, React Router v6, Tailwind CSS, TanStack Query, React Hook Form, Zod, Lucide React | High-performance clinical UI with strict type safety, dark/light clinical aesthetics, and role-based views. |
| **Backend API** | Node.js, Express, TypeScript, Zod | Type-safe REST API (`/api/v1`) with centralized error formatting and async request validation. |
| **Database** | PostgreSQL 16 via Prisma ORM | ACID-compliant relational persistence, foreign key integrity, and normalized healthcare models. |
| **Authentication & RBAC** | `bcryptjs` (Cost 10), RFC 7519 JWT, Role-Based Route Guards | Secure credentials, stateless sessions, and role separation (`ADMIN`, `RECEPTION`, `TECHNOLOGIST`, `RADIOLOGIST`). |

---

## 📂 4. Project Structure (Monorepo)

```text
ris-system/
├── client/                     # Frontend SPA (React + TypeScript + Vite)
│   ├── src/
│   │   ├── app/                # Root App & React Router definitions
│   │   ├── components/
│   │   │   ├── ui/             # Reusable UI primitives (Button, Card, Badge, Table, Input, Tabs)
│   │   │   └── shared/         # Domain components (Header, Sidebar, RoleBadge, IdentifierPill, StatusBadge)
│   │   ├── features/           # Feature-oriented domain modules
│   │   │   ├── auth/           # AuthContext, ProtectedRoute, LoginForm (with 1-click role switcher)
│   │   │   ├── dashboard/      # WorkflowVisualizer, DomainRuleDemo, StatsOverview
│   │   │   ├── health/         # SystemHealth diagnostics
│   │   │   ├── patients/       # Master Patient Index (MPI) registry & MRN generator
│   │   │   └── orders/         # Imaging Orders registry & Accession generator
│   │   ├── layouts/            # AppLayout (Header + Sidebar) and AuthLayout
│   │   ├── pages/              # Routed pages (Dashboard, Workflow, Health, Patients, Orders, Login, 404)
│   │   ├── hooks/              # Custom hooks (useAuth, useHealth)
│   │   ├── lib/                # apiClient fetch wrapper, queryClient, cn utility
│   │   ├── services/           # Typed API service clients (auth, health, patient, order)
│   │   ├── types/              # Domain interfaces & TypeScript types
│   │   └── utils/              # Healthcare formatters (calculateAge, formatDate, formatUptime)
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend REST API (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/             # Environment validation (Zod) & Prisma database singleton
│   │   ├── controllers/        # Request handlers (auth, health, patient, order)
│   │   ├── middleware/         # Centralized error handler, Zod validator, JWT auth, RBAC guard, 404 handler
│   │   ├── routes/             # REST endpoints under /api/v1 (health, auth, patients, orders, etc.)
│   │   ├── services/           # Domain business logic (auth, health, patient, order, audit)
│   │   ├── types/              # API envelopes, JWT payloads, and Express Request augmentation
│   │   ├── utils/              # AppError, apiResponse wrappers, identifier generator, logger
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # HTTP server bootstrap & graceful shutdown
│   ├── package.json
│   └── tsconfig.json
├── prisma/
│   ├── schema.prisma           # 11 normalized models & clinical enums
│   └── seed.ts                 # Realistic clinical seed data (4 users, equipment, inventory, patients, orders)
├── package.json                # Root package with npm workspaces ("server", "client")
├── .env.example                # Example environment variables
├── .env                        # Local active configuration
└── README.md
```

---

## 🗄️ 5. Database Foundation (Prisma ORM)

The relational schema implements 11 normalized entities adhering strictly to Section 6 & 7:

1. **`User`**: Healthcare staff credentials, roles (`ADMIN`, `RECEPTION`, `TECHNOLOGIST`, `RADIOLOGIST`), and active status.
2. **`Patient`**: Master Patient Index (MPI) with unique `patientId` (MRN), demographics, contact information, and audit relations.
3. **`Appointment`**: Scheduled examination time slots, locations, modality, status, and patient foreign keys.
4. **`ImagingOrder`**: Examination request with unique `accessionNumber`, modality, body part, clinical indication, referring doctor, contrast flag, and priority (`ROUTINE`, `URGENT`, `STAT`).
5. **`Study`**: Conceptual imaging study instance UID, matched accession number, acquisition timestamps, and PACS transfer status.
6. **`Report`**: Diagnostic dictation, findings, impressions, radiologist assignment, and status (`DRAFT`, `PRELIMINARY`, `FINAL`, `ADDENDUM`).
7. **`Invoice`**: Patient billing record tied to order accession numbers, itemized totals, and outstanding balances.
8. **`Payment`**: Payment settlements with method (`CASH`, `CREDIT_CARD`, `INSURANCE`), status, and transaction references.
9. **`InventoryItem`**: Medical consumables (e.g. Omnipaque contrast, IV catheters) with batch/lot numbers, SKUs, and expiry dates.
10. **`Equipment`**: Scanners (GE Revolution CT, Siemens Magnetom MRI, Canon Digital X-Ray) with serial numbers and maintenance schedules.
11. **`AuditLog`**: Healthcare compliance log recording user actions, entity mutations, metadata payloads, timestamps, and IP addresses.

---

## 🚀 6. Quick Start & Local Setup

### Prerequisites
* **Node.js** (v18+ or v20+)
* **PostgreSQL** (v15+ or v16+) running locally on port 5432

### Step-by-Step Installation

```bash
# 1. Install all dependencies across monorepo workspaces
npm install

# 2. Configure Environment Variables
cp .env.example .env

# 3. Synchronize Database Schema with PostgreSQL
npm run db:push

# 4. Seed Clinical Demo Data
npm run db:seed

# 5. Start Development Servers (API on :5000, Web on :5173)
npm run dev
```

### Pre-configured Seed Demo Accounts
All accounts are seeded with password: `Demo@123`

| Role | Name | Email | Clinical Scope |
| :--- | :--- | :--- | :--- |
| **RECEPTION** | Sarah Jenkins | `reception@ris.local` | Patient registration, scheduling, check-in |
| **TECHNOLOGIST** | Marcus Vance, RT | `tech@ris.local` | Modality worklist, exam acquisition, contrast log |
| **RADIOLOGIST** | Dr. Elena Rostova | `rad@ris.local` | Diagnostic interpretation, dictation, and attestation |
| **ADMIN** | Dr. Arthur Evans | `admin@ris.local` | System administration, user accounts, and audit trail |

> **Interviewer Tip:** The login page and user avatar header include a **1-Click Role Switcher** to instantly evaluate perspective-specific workflows without manual typing!

---

## 🔍 7. Verification & Health Diagnostics

* **API Health Check:** `GET /api/v1/health`
  ```bash
  curl http://localhost:5000/api/v1/health
  ```
  Returns:
  ```json
  {
    "success": true,
    "message": "System health check completed successfully",
    "data": {
      "status": "healthy",
      "timestamp": "2026-11-05T05:40:47.343Z",
      "environment": "development",
      "version": "1.0.0",
      "uptimeSeconds": 6,
      "database": {
        "connected": true,
        "responseTimeMs": 11
      },
      "system": {
        "nodeVersion": "v26.13.0",
        "platform": "win32",
        "memoryUsageMb": {
          "rss": 90.73,
          "heapTotal": 25.76,
          "heapUsed": 20.74
        }
      }
    }
  }
  ```
* **Frontend Health Dashboard:** Navigate to `http://localhost:5173/health` to view real-time latency graphs, runtime memory utilization, and raw payload inspectors.
