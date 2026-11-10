# RadAxis RIS — Deployment & Local Setup Runbook

This guide covers installing, configuring, containerizing, and running **RadAxis RIS** in a local development or enterprise evaluation environment.

---

## 1. System Requirements & Prerequisites

Ensure the following runtimes and services are installed on your host machine:

| Component | Minimum Version | Verified Version | Purpose |
|---|---|---|---|
| **Node.js** | `>= 20.0.0` (LTS) | `v20.18.0` | Backend API runtime & frontend build engine |
| **npm** | `>= 10.0.0` | `10.8.2` | Workspace package management |
| **Docker & Docker Compose** | Engine `>= 24.0` | Latest | PostgreSQL, Orthanc PACS, and OHIF Viewer containers |
| **Git** | `>= 2.40` | Latest | Source control management |

---

## 2. Environment Configuration

The repository uses environment variables to configure network ports, database connectivity, and PACS endpoints.

Create a `.env` file in the repository root by copying the template:

```bash
cp .env.example .env
```

### Key Environment Variables

```env
# Application Ports
PORT=5000
CLIENT_PORT=5173

# Database (PostgreSQL 16)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/radaxis_ris?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=radaxis_ris

# Security & Sessions
JWT_SECRET=radaxis_enterprise_secure_jwt_secret_dev_2026
JWT_EXPIRES_IN=8h

# Orthanc PACS DICOM Archive
ORTHANC_URL=http://localhost:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
ORTHANC_DICOM_AET=MANRAD
ORTHANC_DICOM_PORT=4242

# OHIF Medical Imaging Viewer
OHIF_VIEWER_URL=http://localhost:3000
```

---

## 3. Step-by-Step Installation

### Step 3.1: Install Dependencies
Run from the repository root to install dependencies across the monorepo workspaces (`server` and `client`):

```bash
npm install
```

### Step 3.2: Launch Infrastructure Containers (Docker Compose)
Start the PostgreSQL database, Orthanc PACS server, and OHIF Viewer containers:

```bash
docker compose up -d
```

Verify that all three containers are healthy:

```bash
docker compose ps
```

Expected running containers:
- `manrad-db` (PostgreSQL 16 on port `5432`)
- `manrad-orthanc` (Orthanc PACS on port `8042` HTTP / `4242` DICOM)
- `manrad-ohif` (OHIF Viewer v3 on port `3000`)

### Step 3.3: Initialize Database Schema
Generate the Prisma client and apply database migrations:

```bash
# Generate Prisma Client types
npm run db:generate

# Apply migrations to PostgreSQL
npm run db:migrate:deploy
```

### Step 3.4: Seed Clinical Master Data
Populate the database with clinical users, modality machines, price catalogs, and initial patient encounters:

```bash
npm run db:seed
```

### Step 3.5: Seed Demo DICOM Studies into Orthanc PACS
Upload authoritative test DICOM studies (`ACC-2026-DEMO00` baseline and `ACC-2026-DEMO01` follow-up) directly into Orthanc:

```bash
npm run seed:demo-dicom
```

---

## 4. Starting the Application

### Option A: Unified Dev Server (Recommended)
Start both the Express REST API (port `5000`) and the Vite React frontend (port `5173`) in a single terminal:

```bash
npm run dev
```

### Option B: Independent Server Startup
Run each service in separate terminal sessions:

```bash
# Terminal 1 — Backend API Server
cd server
npm run dev

# Terminal 2 — Frontend Web Client
cd client
npm run dev
```

---

## 5. Network Topology & Ports

| Service | Port | Local URL | Description |
|---|---|---|---|
| **RadAxis Web Client** | `5173` | `http://localhost:5173` | Main clinical web workstation interface |
| **RadAxis Core API** | `5000` | `http://localhost:5000/api/v1` | Express REST API server |
| **API Health Check** | `5000` | `http://localhost:5000/api/v1/health` | Uptime and database health ping |
| **OHIF Medical Viewer** | `3000` | `http://localhost:3000` | Zero-footprint DICOMweb diagnostic viewer |
| **Orthanc PACS Web** | `8042` | `http://localhost:8042` | Orthanc administrative console & REST API |
| **Orthanc DICOM Port** | `4242` | `localhost:4242` | DICOM C-STORE and C-FIND listener |
| **PostgreSQL Database** | `5432` | `localhost:5432` | Relational clinical database |

---

## 6. Running Verification & Automated Tests

Execute the automated test suite covering unit tests, integration tests, and PACS smoke tests:

```bash
# Run all server test suites
npm test
```

Expected result:
```
✓ 179 test suites passed
✓ 681 tests passed
```

### Targeted Test Commands
```bash
# Run unit tests only
npm run test:unit

# Run API integration tests only
npm run test:api

# Run Orthanc PACS integration tests
npm run test:orthanc
```

---

## 7. Troubleshooting & Operational FAQs

### 1. Port 5000 or 5173 already in use
Check active processes occupying the ports and terminate stale Node instances:
- **Windows (PowerShell)**:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```
- **macOS / Linux**:
  ```bash
  lsof -ti:5000 | xargs kill -9
  ```

### 2. Orthanc PACS DICOMweb 401 Unauthorized
Verify that the `ORTHANC_USERNAME` and `ORTHANC_PASSWORD` in your `.env` match the credentials configured in `compose.yml` (`orthanc` / `orthanc`).

### 3. Prisma Client Out of Sync
If schema fields are updated or after a fresh pull:
```bash
npx prisma generate
```

### 4. Database Container Reset
To completely reset local database storage:
```bash
docker compose down -v
docker compose up -d
npm run db:migrate:deploy
npm run db:seed
npm run seed:demo-dicom
```

