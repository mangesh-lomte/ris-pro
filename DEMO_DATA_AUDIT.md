# RadAxis RIS — Demo Data Consistency & Clinical Realism Audit

**Audit Date**: November 17, 2026  
**Auditor**: Senior Release Engineer & Clinical Data Auditor  
**Target Database**: PostgreSQL 16 (`radaxis_db` on isolated port 5434)

---

## 1. Relational Integrity Architecture

Every demonstration record adheres strictly to real clinical radiology workflow relationships:
$$\text{Patient (MRN)} \longrightarrow \text{ImagingOrder (Accession \#)} \longrightarrow \text{Appointment (Slot / Suite)} \longrightarrow \text{SafetyScreening (Gate)} \longrightarrow \text{DiagnosticReport (HMAC Sign)} \longrightarrow \text{Invoice (POS)}$$

There are **zero orphan records**, **zero unlinked accessions**, and **zero non-deterministic random IDs** displayed in the user interface.

---

## 2. Key Demo Clinical Personas & Data Consistency Ledger

| Entity / Persona | Unique Identifier | Linked Accession(s) | Modality & Procedure | Status Progression | Consistency Check Status |
|:---|:---|:---|:---|:---|:---:|
| **Eleanor Vance (Demo Golden Path)** | `PAT-2026-DEMO01`<br>DOB: 1985-04-12 (41y/F)<br>Phone: `+1-555-010-0001` | • `ACC-2026-DEMO00`<br>• `ACC-2026-DEMO01` | **CT Chest with Contrast** (133 DICOM instances in Orthanc PACS) | • Baseline reported<br>• Follow-up drafted & signed live<br>• Delivered to Front Desk | **VERIFIED PASS**<br>Orthanc PACS fixture matched; OHIF viewer launch verified; HMAC-SHA256 signature applied; Front-desk pickup active. |
| **Margaret Chen (Universal Search Demo)** | `PAT-2026-10002`<br>DOB: 1985-09-24 (41y/F)<br>Phone: `+1-555-014-9920` | `ACC-20261105-MR02` | **MRI Brain with & without Contrast** (Brain Protocol, Dr. House) | • Checked In<br>• Safety Cleared<br>• Scheduled 09:30 | **VERIFIED PASS**<br>Universal fast search surfaces patient instantly; Demographics, wristband print modal, and order history render with 0 errors. |
| **Jonathan Miller (STAT Trauma Demo)** | `PAT-2026-10001`<br>DOB: 1978-02-14 (48y/M)<br>Phone: `+1-555-012-3456` | `ACC-20261105-CT01` | **CT Chest Angiography** (PE Protocol, STAT Priority) | • Checked In<br>• Safety Cleared<br>• 3 Prior Studies | **VERIFIED PASS**<br>Open Exam modal tested; prior studies length bug fixed; protocol confirmation gate verified; DLP/CTDI dose fields verified. |
| **Sarah Connor (Patient Self-Service Demo)** | `PAT-2026-23291`<br>DOB: 1990-05-15 (36y/F)<br>Phone: `5550149920` | `ACC-20261117-CT-DD38`<br>Ref: `APT-2026-1336` | **CT Chest Angiography** (Self-Service Online Booking) | • Confirmed via Demo OTP (`123456`)<br>• Slot: Nov 18, 1:30 PM<br>• ₹50.00 Deposit Paid | **VERIFIED PASS**<br>Created live during Playwright MCP testing; Receipt `REC-1794930886693` issued; Pre-visit safety questionnaire stored. |
| **Emergency Trauma Buffer (Walk-In)** | `PAT-2026-48409`<br>`PAT-2026-72798`<br>`PAT-2026-25964` | `ACC-20261117-CT-6FBF`<br>`ACC-20261117-CT-DCB2`<br>`ACC-20261117-CT-DFBD` | **CT Chest Angiography with Contrast** (Trauma Walk-in Protocol) | • Registered via Walk-In modal<br>• Token issued<br>• Queued for Technologist | **VERIFIED PASS**<br>Walk-in modal test passed; Token generation verified; Visible on Dashboard Modality Operations Matrix. |

---

## 3. Modality & Biomedical Fleet Data Consistency

The database maintains strict cross-module alignment between the **Dashboard Fleet Telemetry**, the **Scheduling Modality Calendar**, the **Technologist MWL**, and the **Biomedical Maintenance Register**:

| Equipment Name | Modality | Suite / Location | Telemetry Status | Scheduled Today | Active Scans | Maintenance Status | Cross-Module Audit Result |
|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **GE Revolution CT 128-Slice** | CT | Ground Floor, Suite CT-01 | **OPERATIONAL** | 9 | 0 | Available | **CONSISTENT** (Dashboard, Calendar, Tech, Maint.) |
| **Siemens Magnetom 1.5T Aera** | MRI | Ground Floor, Suite MRI-01 | **OPERATIONAL** | 4 | 0 | Available | **CONSISTENT** (Dashboard, Calendar, Tech, Maint.) |
| **Siemens MAGNETOM Vida (P36)** | MRI | Ground Floor, Suite MRI-02 | **OPERATIONAL** | 4 | 0 | Available | **CONSISTENT** (Dashboard, Calendar, Tech, Maint.) |
| **Canon CXDI Digital Radiography Suite** | XRAY | First Floor, Suite XR-01 | **MAINTENANCE** | 2 | 0 | **Under PM** | **CONSISTENT** (Flagged across Dashboard, Calendar, Maint.) |

---

## 4. Financial & Billing Reconciliation

- **Audited Daily Revenue Total**: ₹1,500.00
- **Dashboard Overview Card**: ₹1,500.00 (Audited Receipts)
- **Billing Ledger**:
  - Invoice `INV-2026-0001`: ₹550.00 (Paid via Credit Card)
  - Invoice `INV-2026-0002`: ₹750.00 (Paid via UPI)
  - Invoice `INV-2026-0003`: ₹200.00 (Paid via Cash)
  - **Sum of Completed Payments**: ₹1,500.00 (**Exact 100% Match**)
- **Advance Booking Deposits**: Tracked in separate escrow liability ledger (e.g. ₹50.00 for Sarah Connor) and credited upon final exam invoice issuance.

---

## 5. Summary of Demo Data Fixes Applied

1. **Technologist Prior Studies Null Handling**: Prior study array gracefully handles single, multiple, or zero prior imaging history entries without runtime errors.
2. **Technologist Protocol Date Formatting**: Eliminated `Approved Invalid Date` by guarding date rendering against missing or null protocol approval timestamps.
3. **Scheduling Staff Lookup**: Implemented dedicated `/appointments/scheduling-staff` controller and route, providing realistic technologist and nurse allocation dropdowns.
4. **External Shares Array Formatting**: Normalized REST response objects so that single shares, bulk arrays, and paginated wrappers are handled uniformly.
5. **Environment Branding**: Switched all visual tags from production misleading labels to `v2.4.1 Demo` / `DEMO`.
