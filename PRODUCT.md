# PRODUCT TRUTH — Radiology Information System (RIS)

## 1. Product Identification
- **Name**: RadAxis RIS (RadAxis Enterprise RIS)
- **Product Type**: Enterprise Clinical Radiology Information System & Diagnostic Imaging Workflow Orchestrator
- **Design Mode**: `OPERATE` (Focused on task execution, high information density, scanability, clinical clarity, and rapid keystroke-driven operations)
- **Scope Authority**: `docs/interviewer/RIS_Complete_Pagewise_Tools_List.docx.PDF` (174 Specific Functional Requirements across 14 Modules)

---

## 2. Clinical User Profiles & Usage Realities

### Primary Operational Roles
1. **Reception / Front Desk Staff** (`RECEPTION`)
   - **Environment**: High-throughput front counter, noisy waiting room, patient-facing.
   - **Core Jobs**: Patient master search/registration, token issuance, multi-scanner scheduling, pre-bill calculation, INR cashier collections, physical report handover.
   - **Design Imperatives**: Rapid keyboard entry, zero ambiguous status pills, immediate visual confirmation of token and accession numbers.

2. **Radiology Technologist / Modality Operator** (`TECHNOLOGIST`)
   - **Environment**: Scanner control console (CT, MRI, X-Ray suites), dimmed lighting, sterile/busy prep areas.
   - **Core Jobs**: Modality Worklist (MWL) retrieval, mandatory MRI safety screening, IV contrast tracking (eGFR verification, batch/lot logging, extravasation logging), DICOM image quality acceptance (QA), PACS handoff dispatch.
   - **Design Imperatives**: High-contrast urgency indicators (STAT vs. URGENT vs. ROUTINE), strict sequential gating (cannot scan before safety clearance), rapid single-click acceptance.

3. **Radiologist / Reporting Physician** (`RADIOLOGIST`)
   - **Environment**: Diagnostic reading room with multi-monitor workstation (high-luminance DICOM monitors + RIS monitor), low ambient light.
   - **Core Jobs**: Reading unassigned/assigned worklists, launching synchronized PACS / OHIF Viewer sessions, structured report drafting with specialty templates, voice dictation, prior study comparison, peer review, critical findings alert dispatch, digital signature/locking.
   - **Design Imperatives**: Ergonomic dark/subdued or glare-free interface, high textual readability, rapid keyboard shortcuts for template insertion, non-overlapping modals, wide reporting canvas.

4. **Hospital System Administrator & Compliance Officer** (`ADMIN`)
   - **Environment**: Operational back-office, administrative desktop.
   - **Core Jobs**: Staff RBAC user provisioning, end-to-end immutable audit logging, clinical master management (exam definitions, modality schedules, price catalogs), patient duplicate merging, disaster recovery & automated backup monitoring.
   - **Design Imperatives**: Clear data tables, granular filtering, safe destructive action confirmations, transparent system health metrics.

### Secondary Stakeholders
5. **Patient / Family Proxy** (`PATIENT`)
   - **Touchpoint**: Self-service appointment booking modal, QR code accession tracking, PDF report retrieval.
   - **Design Imperatives**: Clear plain-language instructions, simple OTP authentication, contrast preparation guidelines, zero exposed internal developer jargon.

6. **Referring Physician / External Care Team** (`REFERRING CLINICIAN`)
   - **Touchpoint**: Cryptographically secured external study shares, interactive zero-footprint DICOM viewer access, finalized signed PDF reports.
   - **Design Imperatives**: Rapid access without forced account creation, clear diagnostic impressions, verified accession and study details.

---

## 3. Core Clinical Workflows
```
Patient Intake (Reception)
  → Appointment Booking & Scheduling (Multi-modality slots)
  → Token Issuance & Check-in
  → Clinical Safety Gate & Contrast Screening (Technologist)
  → Modality Execution & Acquisition (Scanner console)
  → Image QA & PACS Storage Commitment (Orthanc)
  → Diagnostic Reading & OHIF Measurement (Radiologist)
  → Structured Report Authorization & Cryptographic Sign-Off
  → Front-Desk / Portal Delivery & Financial Cashier Closing
```

---

## 4. UI/UX Priorities (Ranked for OPERATE Mode)
1. **Clinical Safety & Scanability**: STAT and critical findings must immediately stand out with unmistakable visual weight.
2. **Deterministic Data Density**: Maximize meaningful clinical context per viewport without excessive empty whitespace.
3. **Information Hierarchy**: Patient identity (MRN), Accession number, Modality, and Urgency must always precede administrative metadata.
4. **Consistency**: Uniform table layouts, button styling, badge color tokens, and modal dimensions across all 14 modules.
5. **Accessibility**: Full WCAG 2.1 AA compliance, robust focus rings for keyboard navigation, high text-to-background contrast.
6. **Speed & Efficiency**: Zero blocking animations; fast modal rendering; clear loading and empty states.
7. **Professional Restraint**: Clean enterprise clinical aesthetic; elimination of promotional marketing claims, AI gradients, and internal phase labels.

---

## 5. Product Tone & Voice
- **Tone**: Authoritative, clinically precise, sober, reassuring.
- **Copy Standards**: Medical terms and standardized DICOM/IHE terminology (e.g., Accession Number, StudyInstanceUID, Modality Worklist, Contraindication).
- **Prohibited Voice**: Promotional slogans ("World-class", "AI-powered magic"), playful emojis in clinical logs, or unsupported compliance boasts without formal institutional certification.

