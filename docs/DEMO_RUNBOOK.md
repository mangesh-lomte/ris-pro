# RadAxis RIS — End-to-End Demonstration Runbook

This runbook guides evaluators and interviewers through a complete, live walkthrough of the **RadAxis Radiology Information System (RIS)** across all 14 clinical and administrative modules.

---

## 1. Quick Reference: Demo Roles & Portals

| Role / Surface | Access URL | Demo Identity / Account | Purpose |
|---|---|---|---|
| **System Administrator** | `http://localhost:5173/login` | `admin@ris.local` / `<DEMO_PASSWORD>` | User provisioning, audit trail, master data |
| **Reception / Front Desk** | `http://localhost:5173/login` | `reception@ris.local` / `<DEMO_PASSWORD>` | Patient intake, scheduling, check-in, cashiering |
| **Radiology Technologist** | `http://localhost:5173/login` | `tech@ris.local` / `<DEMO_PASSWORD>` | Safety screening, scan execution, image QA |
| **Radiologist** | `http://localhost:5173/login` | `rad@ris.local` / `<DEMO_PASSWORD>` | Diagnostic reporting, OHIF launch, peer review |
| **Patient Self-Service** | `http://localhost:5173/patient-portal`| Mobile: `555-0199` / OTP: `<DEMO_OTP>` | Appointment booking, prep rules, report download |
| **External Care Recipient**| `http://localhost:5173/share/:token` | Share Token: `<DEMO_SHARE_TOKEN>` | Clinical study sharing, OTP gate, OHIF viewer |
| **OHIF Imaging Viewer** | `http://localhost:3000` | Integrated Web Client | Zero-footprint web DICOM viewer |
| **Orthanc PACS Console** | `http://localhost:8042` | `orthanc` / `orthanc` | PACS archive management & DICOMweb |

---

## 2. End-to-End Clinical Demonstration Flow

### Scene 1: Executive Dashboard & Operational Telemetry (Module 01)
1. Navigate to `http://localhost:5173/login`.
2. Sign in with the **Receptionist** or **Admin** profile.
3. Observe the **Executive Dashboard**:
   - **Today Overview Cards**: Total bookings, completed scans, pending reports, and total revenue in Indian Rupees (`₹`).
   - **Live Patient Pipeline**: Visual progression tracking stages (`Booked` $\to$ `Arrived` $\to$ `Waiting` $\to$ `Scanning` $\to$ `Reporting` $\to$ `Delivered`).
   - **Modality Status Tiles**: Real-time status for MRI, CT, and X-Ray suites (`OPERATIONAL`, `BUSY`, `MAINTENANCE`).
   - **Pending-Task Alerts**: STAT critical flags, delayed appointments, and unassigned studies.
   - **Universal Search**: Type a Patient Name, Mobile Number, or Accession Number (`ACC-...`) to locate clinical records instantly.

---

### Scene 2: Patient Intake & Appointment Scheduling (Modules 02 & 03)
1. In the sidebar, select **Appointments & Scheduling**.
2. Click **+ New Appointment**:
   - Select patient or register a new patient (generates persistent MRN `PAT-2026-XXXXX`).
   - Choose Modality (`CT Scanner 01`) and Examination (`CT Chest with Contrast`).
   - Select an available date/time slot. Notice real-time conflict detection preventing double-booking.
   - Review patient preparation guidelines (e.g. 4-hour fasting, serum creatinine check).
3. Confirm the booking. Observe the unique Accession Number generated: `ACC-YYYYMMDD-[MOD]-XXXX`.
4. Switch to **Reception Queue**:
   - Locate the scheduled patient in the arrivals list.
   - Click **Check-In**: Verify patient identity, print the queue token, and advance patient status to `ARRIVED`.

---

### Scene 3: Modality Worklist & Patient Check-in (Module 04)
1. Log out and sign in as the **Technologist** (`tech@ris.local`).
2. Navigate to **Modality Worklist**:
   - Observe the checked-in patient automatically reflected in the DICOM Modality Worklist (MWL).
   - Verify DICOM tags: Accession Number, Modality, Scheduled Station AE Title, and Patient Demographics.
   - Inspect the live scanner connection status monitor.

---

### Scene 4: Clinical Safety Screening & Scan Execution (Module 05)
1. On the Technologist Worklist, locate the active examination and click **Prepare Patient**:
   - Complete the **Clinical Safety Gate**: Check for contraindications (implants, pacemakers, allergies).
   - Enter kidney function metrics: eGFR and Serum Creatinine values.
   - If IV contrast is required, enter contrast agent name, volume (mL), batch number, and administration site.
2. Click **Start Scan**:
   - Observe the examination status transition to `IN_PROGRESS`.
   - The acquisition timer activates on the technologist console.
3. After acquisition finishes, click **Complete Scan**:
   - Log technique parameters (kVp, mAs, slice thickness) and radiation dose (DLP in mGy*cm).

---

### Scene 5: Image Quality Assurance & PACS Storage Commitment (Module 06 & 07)
1. On the completion screen, review image count and series metadata.
2. Select **Accept Quality (QA)**:
   - Technologist certifies acceptable positioning and contrast opacification without motion artifact.
3. Click **Initiate PACS Transfer**:
   - Trigger DICOM C-STORE and Storage Commitment to Orthanc PACS.
   - Notice the status badge updating to `PACS_VERIFIED`.
4. Navigate to **PACS Management**:
   - View the received DICOM study listed with matched Accession Number and `StudyInstanceUID`.
   - Verify storage tier allocation and healthy DICOM C-ECHO node response.

---

### Scene 6: Radiologist Diagnostic Worklist & OHIF Launch (Module 08)
1. Sign in as the **Radiologist** (`rad@ris.local`).
2. Navigate to **Radiologist Worklist**:
   - Observe the unassigned study flagged with urgency badge (`ROUTINE`, `URGENT`, or `STAT`).
3. Click **Claim Study**:
   - The study locks to your session to prevent collision with other radiologists.
4. Click **View Images (OHIF)**:
   - Launches the integrated zero-footprint **OHIF Viewer v3** in a synchronized tab with the exact `StudyInstanceUID`.
   - Evaluate multi-planar CT reconstructions (axial, coronal, sagittal), window leveling, and distance calipers.
5. In the RIS Reporting Workspace:
   - Compare with prior historical baseline studies (`ACC-2026-DEMO00`) rendered side-by-side.
   - Select a pre-configured template (e.g., *CT Chest Standard Protocol*).
   - Use voice dictation or keyboard input to complete the Clinical History, Findings, and Impression sections.

---

### Scene 7: Critical Findings Alert & Peer Review (Module 09)
1. *(Optional clinical scenario)*: If an acute finding is identified (e.g., pulmonary embolism, pneumothorax):
   - Click **Send Critical Alert**:
   - Select the referring clinician and specify the critical diagnosis.
   - The alert broadcasts an immediate high-priority red alert banner across the platform.
2. *(Quality assurance)*:
   - Click **Request Peer Review**: Submit the study to the double-read queue for concordance scoring (RADPEER 1–4).

---

### Scene 8: Report Finalization, Digital Signing & PDF Release (Module 10)
1. In the Reporting Workspace, click **Sign & Finalize**:
   - System prompts for electronic signature confirmation.
   - Report status locks to `FINAL`. The text becomes strictly immutable.
2. Click **Generate PDF**:
   - Renders the authoritative clinical report PDF with formal clinic letterhead, doctor credentials, timestamp, and digital verification QR code.
3. Click **Release to Reception**:
   - Makes the finalized report instantly available at the front desk for physical handover and patient portal download.

---

### Scene 9: Billing, Cashier Settlement, Discounts & TPA (Module 11)
1. Sign in as **Reception / Cashier** or navigate to **Billing & Accounts**.
2. Select the patient's invoice:
   - Notice itemized gross charges in Indian Rupees (`₹`), including exam base rate, contrast charges, and consumables.
3. **Discount Approval Workflow**:
   - Enter a valid discount (e.g. `₹50.00`).
   - System validates discount eligibility against the gross total.
4. **Collect Payment**:
   - Select payment method (`Cash`, `Card`, or `UPI`).
   - Enter payment amount and click **Record Payment**.
   - Print or view the official payment receipt in INR.
5. **TPA / Insurance Claims**:
   - Click **Submit TPA Claim**:
   - Confirm insurance provider, policy number, pre-authorization code, and claim amount.
   - System associates the invoice and patient identity seamlessly.
6. **Cashier Closing**:
   - Review the shift drawer summary tallying cash, card, and UPI transactions.
   - Click **Close Shift Drawer** to reconcile and lock the session.

---

### Scene 10: Inventory & Consumables Tracking (Module 12)
1. Navigate to **Inventory & Consumables**:
   - Inspect stock levels of contrast agents, syringes, catheters, and film sheets.
   - Review the **FEFO (First-Expired-First-Out)** dispensing queue.
   - Inspect the **Crash Cart Emergency Medication Register** with expiration alerts.
   - Review stock audit logs and recorded film sheet counts.

---

### Scene 11: Equipment Maintenance & Quality Control (Module 13)
1. Navigate to **Equipment Maintenance**:
   - Review all imaging machines (CT, MRI, X-Ray) and operational uptime percentages.
   - Log a daily **Phantom QC Check** (water CT number, noise standard deviation, SNR).
   - View scheduled Preventive Maintenance (PM) service contracts and uploaded calibration certificates.

---

### Scene 12: External DICOM Sharing with OTP Protection (Module 14)
1. Navigate to **DICOM Sharing**:
   - Click **+ New External Share**.
   - Select a verified completed study (e.g., `ACC-2026-DEMO00`).
   - Set recipient details (e.g., *Dr. Raymond Palmer*) and configure access validity (e.g. 7 days).
   - Check **Require 2FA / OTP Verification**.
2. Click **Generate Share Link**:
   - Copy the generated secure recipient link: `http://localhost:5173/share/<DEMO_SHARE_TOKEN>`.
3. Open an Incognito window and navigate to the share URL:
   - The **Clinical Access Verification** portal appears.
   - Enter the 6-digit OTP delivered via the local demonstration adapter (`<DEMO_OTP_FROM_LOCAL_ADAPTER>`).
   - Click **Unlock Diagnostic Study**.
4. The verified **Shared Study Recipient Portal** opens:
   - View full diagnostic study metadata and clinical indication.
   - Click **Launch Web Viewer** to examine images in OHIF.
   - Click **Download Final Report (PDF)** to retrieve the signed report.
   - Click **Download DICOM ZIP** for full raw image archives.

---

### Scene 13: Patient Self-Service Portal
1. Navigate to `http://localhost:5173/patient-portal`.
2. Enter patient mobile number: `555-0199`.
3. Enter OTP: `<DEMO_OTP>` (or demo OTP `123456`).
4. The patient dashboard opens:
   - View upcoming appointments and historical imaging studies.
   - Access pre-procedure fasting and preparation instructions.
   - Click **Download Report** to retrieve finalized diagnostic PDFs.
   - Click **View Images** to launch patient-authorized medical scans.
   - Cross-patient authorization check: Attempts to query another patient's accession return `403 Forbidden`.

---

### Scene 14: System Administration & Immutable Audit Trail
1. Sign back in as the **Administrator** (`admin@ris.local`).
2. Navigate to **System Administration**:
   - View user accounts, role allocations, and deactivation toggles.
   - Inspect the **Clinical Audit Trail**: Every action taken during this demonstration (patient intake, scan completion, report signature, PDF print, and external share access) is recorded with timestamp, user ID, IP address, and entity ID.
   - Review automated database backup snapshots and disaster recovery drill logs.

