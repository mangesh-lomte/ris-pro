# RadAxis RIS — Radiology Information System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Orthanc PACS](https://img.shields.io/badge/Orthanc_PACS-24.12-darkred.svg)](https://www.orthanc-server.com/)
[![OHIF Viewer](https://img.shields.io/badge/OHIF_Viewer-v3-orange.svg)](https://ohif.org/)
[![Tests](https://img.shields.io/badge/Tests-681%20Passed-success.svg)](#-automated-testing--quality-assurance)

**RadAxis RIS** is an enterprise-grade, clean-architecture Radiology Information System (RIS) and diagnostic imaging workflow orchestrator. Engineered for high-throughput diagnostic centers and hospital radiology departments, RadAxis coordinates every phase of clinical operations: from multi-channel patient registration and modality scheduling, to technologist scan execution, Orthanc PACS image commitment, synchronized OHIF diagnostic viewing, structured reporting with voice dictation, INR cashier settlement, and cryptographic external study sharing.

---

## 📽️ Demonstration Video

> [Final demonstration video — link to be added before submission]

---

## 🏥 1. System Objective & Core Workflows

The primary objective of RadAxis RIS is to guarantee diagnostic continuity, patient safety, and operational throughput while maintaining absolute separation between relational workflow orchestration (RIS) and binary DICOM image archiving (PACS).

```text
Patient Registration (Reception / Portal)
  ├── Persistent Patient MRN (PAT-YYYY-XXXXX)
  └── Multi-Modality Appointment & Slot Allocation
        │
        ▼
Front Desk Check-in & Waiting Queue
  ├── 2-Identifier Verification & Wristband Token ([MOD]-001)
  └── Order Creation & Accession Number (ACC-YYYYMMDD-[MOD]-XXXX)
        │
        ▼
Modality Worklist (MWL) & DICOM Integration
  ├── Modality C-FIND Query
  └── Patient Preparation & Clinical Safety Clearance (eGFR / Implants)
        │
        ▼
Scanner Execution & Technologist Console
  ├── Scan Acquisition, Protocol Parameters, DLP Radiation Dose
  └── Image Quality Assurance (QA) Acceptance
        │
        ▼
PACS Storage Commitment (Orthanc DICOM C-STORE)
  └── StudyInstanceUID Relational Reconciliation
        │
        ▼
Radiologist Diagnostic Worklist
  ├── Claim Study (Concurrency Lock)
  ├── Synchronized OHIF Viewer Launch (Port 3000)
  ├── Prior Study Comparison & Voice Dictation
  └── Critical Finding Alerts & Peer Review (RADPEER)
        │
        ▼
Report Electronic Authorization & Digital Signing
  ├── Status Locked to FINAL (Cryptographic Attestation)
  └── Authoritative Signed PDF Release with QR Verification
        │
        ▼
Billing, Delivery & External Sharing
  ├── Front Desk Handover & SMS/Email Notification
  ├── Itemized Billing (INR ₹), Cashier Closing, TPA Insurance
  ├── Patient Self-Service Portal (OTP Login & Report Download)
  └── External Clinician Sharing (Cryptographic Token + 2FA Gate)
```

---

## 📋 2. Comprehensive 14-Module Scope

RadAxis RIS fulfills all 174 requirements specified across the 14 core operational modules:

1. **Module 01: Main Desktop Dashboard** — Executive KPI cards (bookings, scans, reports, INR revenue), live patient progression pipeline, real-time modality tiles, STAT pending-task alerts, and universal search.
2. **Module 02: Online Patient Appointment Portal** — Mobile OTP authentication, examination catalog selection, date/time slot picker, clinical questionnaire, pre-scan instructions, and booking confirmation.
3. **Module 03: Reception & Front Desk** — Patient master registration, duplicate candidate detection, 2-identifier check-in, queue token sequencing (`[MOD]-001`), appointment management, and patient label printing.
4. **Module 04: Modality Worklist (MWL) & DICOM Integration** — Standard DICOM Modality Worklist C-FIND query responses, MPPS acquisition step tracking, and live AE title connection monitoring.
5. **Module 05: Technologist Execution & Scan Lifecycle** — Mandatory MRI/CT clinical safety gate, eGFR/creatinine contrast screening, adverse incident logging, and scan acquisition timers.
6. **Module 06: Quality Assurance & Image Acceptance** — Technologist image quality acceptance, repeat exposure authorization, and automated DICOM C-STORE transfer to PACS.
7. **Module 07: PACS Management & Image Reconciliation** — Multi-archive storage tiering, DICOM C-ECHO ping monitor, external media import, and unassociated study reconciliation.
8. **Module 08: Radiologist Reading Worklist & Reporting** — Unassigned/assigned study claiming, synchronized OHIF Viewer launch, multi-specialty reporting templates, voice dictation, and prior comparison.
9. **Module 09: Critical Findings & Peer Review** — Real-time red alert dispatch for life-threatening diagnoses, receipt acknowledgment tracking, and randomized double-read RADPEER scoring.
10. **Module 10: Report Finalization, Digital Signing & Delivery** — Electronic signature authorization, status locking (`FINAL`), tamper-evident PDF generation with QR verification, and physical handover tracking.
11. **Module 11: Billing, Accounts, Invoicing & Cashiering** — Multi-modality price catalog, quotation generation, itemized invoices in Indian Rupees (`₹`), discount approval validation, receipt issuance, TPA insurance claims, and cashier shift closing.
12. **Module 12: Consumables & Contrast Inventory** — First-Expired-First-Out (FEFO) dispensing, lot/batch tracking, crash cart emergency checklist, scan consumable logging, and physical stock count audits.
13. **Module 13: Equipment Maintenance & Quality Control** — Radiology asset register, daily technologist phantom QC tests, breakdown service tickets, downtime tracking, and radiation calibration certificates.
14. **Module 14: External DICOM Study Sharing** — Cryptographically generated recipient share tokens (`SHR-YYYY-XXXX`), 6-digit OTP verification gate, interactive zero-footprint web viewer, locked report PDF downloads, and DICOM ZIP export.

---

## 👥 3. User Roles & Permission Model

RadAxis enforces strict Role-Based Access Control (RBAC) at the route, service, and UI layer:

| Role | Access Scope |
|---|---|
| **System Administrator** (`ADMIN`) | User account provisioning, role assignment, clinical master data, retention policies, backup/DR drills, and immutable audit logs. |
| **Radiologist** (`RADIOLOGIST`) | Diagnostic reading worklist, unassigned study claiming, OHIF viewer integration, reporting workspace, addenda/amendments, critical finding alerts, and peer review. |
| **Radiology Technologist** (`TECHNOLOGIST`)| Modality worklist, safety checklists, IV contrast tracking, scan lifecycle execution, image QA acceptance, and PACS transfer commitment. |
| **Receptionist** (`RECEPTION`) | Patient intake, appointment scheduling, queue check-in, token issuance, physical report delivery, and cashier payments. |
| **Billing / Cashier** (`BILLING`) | Invoices, discount approvals, refund processing, cashier shift settlement, and TPA insurance claim management. |
| **Patient** (`PATIENT`) | Self-service portal: OTP login, appointment booking, preparation instructions, authenticated report PDF download, and personal image viewer. |
| **Referring Doctor** (`REFERRING_DOCTOR`)| Recipient portal: shared study review, locked PDF reports, and external DICOM viewing. |

---

## 🛠️ 4. Technology Stack & System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Tier"]
        WEB["RadAxis Clinical Web UI (Port 5173)\nReact 18 / TypeScript / Vite / Tailwind CSS"]
        OHIF["OHIF Medical Viewer v3 (Port 3000)\nZero-Footprint Web DICOM Viewer"]
    end

    subgraph Server ["Application Logic Tier"]
        API["RadAxis Core API (Port 5000)\nNode.js 20 / Express / TypeScript"]
        AUTH["Stateless JWT & RBAC Middleware"]
        PDF["PDFKit Clinical Report Engine"]
    end

    subgraph Data ["Data & Imaging Persistence Tier"]
        PRISMA["Prisma ORM Client"]
        PG[("PostgreSQL 16 (Port 5432)\nACID Relational Clinical DB")]
        ORTHANC["Orthanc PACS Server (Port 8042 / 4242)\nDICOM Archive & DICOMweb WADO-RS / QIDO-RS"]
    end

    WEB -->|"REST API / JSON + Bearer JWT"| API
    WEB -->|"Synchronized Launch"| OHIF
    OHIF -->|"DICOMweb (WADO-RS / QIDO-RS)"| ORTHANC
    API --> AUTH
    API --> PDF
    API --> PRISMA
    PRISMA --> PG
    API -->|"REST API & DICOMweb"| ORTHANC
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Radix UI Primitives, TanStack React Query.
- **Backend API**: Node.js 20, Express, TypeScript, Zod validation, PDFKit, bcryptjs, jsonwebtoken.
- **Database & ORM**: PostgreSQL 16, Prisma ORM (migrations, relations, seeds).
- **PACS & DICOM**: Orthanc PACS 24.12, DICOMweb plugin (WADO-RS, QIDO-RS, WADO-URI), DICOM C-STORE / C-FIND / C-ECHO.
- **Medical Imaging Viewer**: OHIF Viewer v3.
- **Container Infrastructure**: Docker & Docker Compose (`compose.yml`).

---

## 🔌 5. Network Ports & Services

| Service | Port | URL / Interface | Protocol |
|---|---|---|---|
| **RadAxis Web Interface** | `5173` | `http://localhost:5173` | HTTP / HTML5 |
| **RadAxis Core REST API** | `5000` | `http://localhost:5000/api/v1` | HTTP / JSON |
| **API Health Ping** | `5000` | `http://localhost:5000/api/v1/health` | HTTP / JSON |
| **OHIF Medical Viewer** | `3002` | `http://localhost:3002` | HTTP / Web |
| **Orthanc PACS Web & API**| `8044` | `http://localhost:8044` | HTTP / DICOMweb |
| **Orthanc DICOM Port** | `4244` | `localhost:4244` | DICOM C-STORE |
| **PostgreSQL Database** | `5434` | `localhost:5434` | TCP / PostgreSQL |

---

## 🚀 6. Installation & Quick Start

### Prerequisites
- **Node.js** `>= 20.0.0` and **npm** `>= 10.0.0`
- **Docker & Docker Compose**
- **Git**

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/<org>/radaxis-ris.git
cd radaxis-ris
npm install
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env
```
Ensure database credentials and Orthanc settings match your local Docker environment.

### Step 3: Launch Docker Infrastructure (PostgreSQL, Orthanc PACS, OHIF)
```bash
docker compose up -d
```
Verify running containers:
```bash
docker compose ps
```

### Step 4: Initialize Database Schema & Seed Data
```bash
# Apply Prisma migrations
npm run db:migrate:deploy

# Seed clinical master data, users, and orders
npm run db:seed

# Seed demo DICOM studies into Orthanc PACS
npm run seed:demo-dicom
```

### Step 5: Start the Application
```bash
# Starts both Express API (Port 5000) and Web Client (Port 5173)
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🧪 7. Automated Testing & Quality Assurance

RadAxis RIS includes a comprehensive test suite covering unit logic, clinical API routes, PACS smoke tests, and business validations:

```bash
# Execute full server test suite
npm test
```

### Test Suite Execution Output
```
✓ 179 test suites passed
✓ 681 tests passed
```

### Targeted Test Commands
```bash
npm run test:unit      # Run domain unit tests
npm run test:api       # Run REST API integration tests
npm run test:orthanc   # Run Orthanc PACS connectivity tests
```

---

## 📚 8. Documentation Index

Detailed engineering and operational documentation is available in the [`docs/`](docs/) directory:

- 📐 **[System Architecture](docs/ARCHITECTURE.md)** — In-depth component topology, clinical identifier lifecycles, and security boundaries.
- 📡 **[REST API Reference](docs/API_REFERENCE.md)** — Complete catalog of all endpoints across all 14 modules.
- 🛠️ **[Deployment & Setup Runbook](docs/DEPLOYMENT_AND_SETUP.md)** — Production considerations, multi-container orchestration, and troubleshooting.
- 🎬 **[Demonstration Runbook](docs/DEMO_RUNBOOK.md)** — Step-by-step evaluator script across all 14 modules and demo roles.
- 🎨 **[Enterprise Design System](docs/DESIGN_SYSTEM.md)** — Clinical `OPERATE` tokens, component specifications, and WCAG AA guidelines.
- 🎯 **[Product Truth & Stakeholder Personas](PRODUCT.md)** — Clinical user realities, operating environments, and copy standards.
- 📊 **[Interviewer Requirement Traceability](PDF_TRACEABILITY.md)** — Line-by-line mapping of all 174 functional requirements.
- 📄 **[Interviewer Authority Specification](docs/interviewer/RIS_Complete_Pagewise_Tools_List.docx.PDF)** — Authoritative requirement document.

---

## 🔒 9. Security & Compliance Principles

- **Stateless Authentication**: Signed RFC 7519 JWT tokens with 8-hour expiration.
- **Password Hashing**: Strong `bcryptjs` encryption (10 salt rounds).
- **Cross-Patient Isolation**: Multi-tenant authorization checks preventing cross-patient data access.
- **External Sharing**: Time-limited cryptographic share tokens (`SHR-YYYY-XXXX`) paired with a mandatory 6-digit OTP verification gate.
- **Immutable Audit Trail**: Append-only audit log recording every patient interaction, scan state change, report signature, and external access event.
- **DICOM Separation**: Medical pixel arrays are preserved strictly inside Orthanc PACS, never blobbing relational database tables.

---

## 📌 10. Project Status

RadAxis RIS is **complete, verified, and frozen** for final interviewer submission. All 14 modules, 174 requirements, automated test suites (681 tests), and clinical PACS/OHIF integrations are fully functional.
