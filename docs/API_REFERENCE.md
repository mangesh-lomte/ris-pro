# RadAxis RIS — REST API Reference Specification

Base URL: `http://localhost:5000/api/v1`  
Authentication: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`) unless marked as Public.  
Content-Type: `application/json` (except file downloads / PDF streams / multipart uploads).

---

## 1. Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticates healthcare user using email and password; returns JWT token and role profile. |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieves profile, permissions, and active session details for current user. |

---

## 2. Main Executive Dashboard (`/api/v1/dashboard`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/overview` | All Staff Roles | Retrieves aggregated KPI cards (bookings, scans, pending reports, INR revenue), live pipeline status, modality tiles, pending alerts, and daily analytics. |
| `GET` | `/api/v1/dashboard/search?q=...` | All Staff Roles | Universal search across patients, mobile numbers, Accession Numbers, and MRNs. |

---

## 3. Patient Management & Master Demographics (`/api/v1/patients`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/patients` | All Staff Roles | Paginated list of registered patients with name, mobile, and MRN search filters. |
| `GET` | `/api/v1/patients/generate-id` | Reception, Admin | Generates preview of next sequential Patient MRN (`PAT-YYYY-XXXXX`). |
| `POST` | `/api/v1/patients/duplicate-check` | Reception, Admin | Evaluates patient demographic duplicates based on name, DOB, and phone similarity. |
| `POST` | `/api/v1/patients` | Reception, Admin | Registers new patient master record and assigns persistent MRN. |
| `GET` | `/api/v1/patients/:id` | All Staff Roles | Retrieves full clinical profile, demographics, allergies, and historical orders. |
| `PATCH` | `/api/v1/patients/:id` | Reception, Admin | Updates patient address, emergency contact, or demographic metadata. |

---

## 4. Clinical Imaging Orders (`/api/v1/orders`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/orders` | All Staff Roles | Lists imaging orders with relational patient, urgency, modality, and status. |
| `GET` | `/api/v1/orders/generate-accession` | Reception, Admin | Previews next unique Accession Number (`ACC-YYYYMMDD-[MOD]-XXXX`). |
| `POST` | `/api/v1/orders` | Reception, Admin | Creates diagnostic imaging order and clinical request. |
| `POST` | `/api/v1/orders/import-his` | Admin, Integration | Ingests orders from hospital HIS / EMR interface via JSON payload. |
| `GET` | `/api/v1/orders/:id/tracking` | All Staff Roles | Retrieves historical step-by-step milestone timeline for an order. |
| `POST` | `/api/v1/orders/:id/mwl-sync` | Tech, Admin | Dispatches order to DICOM Modality Worklist (MWL) for modality acquisition. |
| `GET` | `/api/v1/orders/:id` | All Staff Roles | Fetches order details, clinical indication, priority, and linked study/report. |
| `PATCH` | `/api/v1/orders/:id` | Reception, Admin | Modifies order indication, referring doctor, or scheduled time before completion. |

---

## 5. Scheduling & Appointments (`/api/v1/appointments`, `/api/v1/scheduling`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/appointments` | All Staff Roles | Lists scheduled appointments with modality, date range, and status filters. |
| `POST` | `/api/v1/appointments` | Reception, Admin | Books slot with automated modality schedule conflict detection. |
| `GET` | `/api/v1/appointments/prep-check` | All Staff Roles | Verifies required preparation guidelines (fasting, hydration, labs) for scan. |
| `GET` | `/api/v1/appointments/:id` | All Staff Roles | Retrieves single appointment details, patient info, and machine allocation. |
| `POST` | `/api/v1/appointments/:id/reschedule` | Reception, Admin | Reschedules appointment with conflict validation and audit logging. |
| `POST` | `/api/v1/appointments/:id/cancel` | Reception, Admin | Cancels appointment, releases scanner slot, and flags reason. |
| `POST` | `/api/v1/appointments/:id/no-show` | Reception, Admin | Flags appointment as no-show for capacity tracking and follow-up. |
| `POST` | `/api/v1/appointments/:id/check-in` | Reception, Admin | Checks in patient at front desk, marks ARRIVED, and assigns waiting token. |
| `PATCH` | `/api/v1/appointments/:id/allocation` | Tech, Admin | Allocates specific equipment machine, radiographer, and nurse. |
| `GET` | `/api/v1/scheduling/availability` | All Staff Roles | Calculates real-time slot availability for specific modalities and machines. |

---

## 6. Reception Queue & Report Delivery Handover (`/api/v1/reception`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/reception/reports/ready` | Reception, Admin | Lists signed and finalized reports released by radiologists for front-desk handover. |
| `POST` | `/api/v1/reception/reports/:id/handover` | Reception, Admin | Records physical report delivery handover, recipient ID proof, and signature acknowledgment. |
| `POST` | `/api/v1/reception/reports/:id/notify` | Reception, Admin | Dispatches delivery notification (SMS / Email) with download token to patient. |
| `POST` | `/api/v1/reception/reports/:id/reprint` | Reception, Admin | Logs report reprint event, supervisor authorization, and copy count. |
| `GET` | `/api/v1/reception/reports/:id/print-pdf` | Reception, Admin | Streams clinical PDF for physical printing and automatically increments print counter. |
| `GET` | `/api/v1/reception/reports/:id/deliveries` | Reception, Admin | Audit list of all delivery attempts, handovers, and dispatches for an order. |

---

## 7. Technologist Execution & Scan Lifecycle (`/api/v1/technologist`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/technologist/worklist` | Technologist, Admin | Lists pending and active examinations assigned to modality worklists. |
| `GET` | `/api/v1/technologist/worklist/:id` | Technologist, Admin | Retrieves complete technologist context for specific imaging order. |
| `GET` | `/api/v1/technologist/worklist/:id/safety` | Technologist, Admin | Retrieves MRI / CT safety screening checklist. |
| `POST` | `/api/v1/technologist/worklist/:id/safety` | Technologist, Admin | Submits completed screening checklist; blocks progression if contraindication found. |
| `GET` | `/api/v1/technologist/worklist/:id/preparation` | Technologist, Admin | Checks patient preparation confirmation status. |
| `PUT` | `/api/v1/technologist/worklist/:id/preparation` | Technologist, Admin | Confirms preparation clearance (fasting, creatinine, dress code). |
| `POST` | `/api/v1/technologist/worklist/:id/protocol` | Technologist, Admin | Records scanner acquisition protocol parameters, slice thickness, and kVp/mAs. |
| `GET` | `/api/v1/technologist/worklist/:id/scan` | Technologist, Admin | Retrieves scan execution status and timer. |
| `POST` | `/api/v1/technologist/worklist/:id/scan/start` | Technologist, Admin | Sets order status to IN_PROGRESS and logs acquisition start timestamp. |
| `POST` | `/api/v1/technologist/worklist/:id/scan/finish` | Technologist, Admin | Marks scan acquisition finished and triggers QA queue. |
| `GET` | `/api/v1/technologist/worklist/:id/contrast` | Technologist, Admin | Gets contrast administration record. |
| `POST` | `/api/v1/technologist/worklist/:id/contrast` | Technologist, Admin | Logs IV contrast agent, volume (ml), batch number, and route. |
| `POST` | `/api/v1/technologist/worklist/:id/incidents` | Technologist, Admin | Records adverse clinical incidents (extravasation, allergic reaction). |
| `GET` | `/api/v1/technologist/worklist/:id/image-quality` | Technologist, Admin | Retrieves image QA acceptance state. |
| `POST` | `/api/v1/technologist/worklist/:id/image-quality/accept` | Technologist, Admin | Technologist accepts image quality and initiates PACS handoff. |
| `POST` | `/api/v1/technologist/worklist/:id/image-quality/repeat-required` | Technologist, Admin | Requests repeat scan due to patient motion or artifact. |
| `POST` | `/api/v1/technologist/worklist/:id/pacs-handoff/initiate` | Technologist, Admin | Triggers automated transfer commitment to Orthanc PACS archive. |
| `POST` | `/api/v1/technologist/worklist/:id/pacs-study/reconcile` | Technologist, Admin | Manually links unassociated DICOM StudyInstanceUID to RIS order. |
| `POST` | `/api/v1/technologist/worklist/:id/documents` | Technologist, Admin | Uploads clinical documents, referral slips, or screening forms. |

---

## 8. Modality Integration & DICOM Router (`/api/v1/integrations`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/integrations/mwl` | Tech, Admin | Queries DICOM Modality Worklist (MWL) entries. |
| `GET` | `/api/v1/integrations/configs` | Admin | Lists active PACS nodes and modality connection parameters. |
| `POST` | `/api/v1/integrations/configs` | Admin | Creates or updates modality AE title, port, and IP configuration. |
| `POST` | `/api/v1/integrations/c-store` | Integration, Admin | Webhook receiver for inbound DICOM C-STORE instance arrivals. |
| `POST` | `/api/v1/integrations/mpps` | Integration, Admin | Receives Modality Performed Procedure Step (MPPS) progress updates. |
| `POST` | `/api/v1/integrations/storage-commitment` | Integration, Admin | Confirms DICOM Storage Commitment (N-ACTION / N-EVENT-REPORT). |
| `GET` | `/api/v1/integrations/failed-transfers` | Admin | Lists failed DICOM store jobs for re-transmission. |
| `POST` | `/api/v1/integrations/retry-transfer` | Admin | Re-queues failed DICOM transmission. |
| `POST` | `/api/v1/integrations/radiation-dose` | Tech, Admin | Records Radiation Dose Structured Report (RDSR) / DLP metrics. |

---

## 9. PACS Management & Image Reconciliation (`/api/v1/pacs`, `/api/v1/studies`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/pacs/received-studies` | Clinicians, Admin | Lists DICOM studies received in Orthanc PACS with matching RIS status. |
| `GET` | `/api/v1/pacs/viewer-launch/:studyInstanceUid`| Clinicians, Admin | Generates authenticated single sign-on launch URL for OHIF Viewer. |
| `GET` | `/api/v1/pacs/priors/:patientId` | Clinicians, Admin | Retrieves historical baseline DICOM studies for comparative viewing. |
| `POST` | `/api/v1/pacs/route` | Admin | Manually routes study to external teleradiology node or secondary archive. |
| `GET` | `/api/v1/pacs/storage-tiers` | Admin | Reports disk capacity across hot, warm, and archive storage volumes. |
| `GET` | `/api/v1/pacs/nodes/monitor` | Admin | Live DICOM C-ECHO ping status of configured AE titles. |
| `GET` | `/api/v1/studies` | Clinicians, Admin | Lists imaging studies with modality, accession, and image count. |

---

## 10. Radiologist Reporting & Diagnostic Worklist (`/api/v1/radiologist`, `/api/v1/reports`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/radiologist/worklist` | Radiologist, Admin | Filterable radiologist reading queue (Urgency, Modality, Assigned, Unassigned). |
| `POST` | `/api/v1/radiologist/worklist/:id/claim` | Radiologist | Radiologist self-assigns unassigned study to lock out concurrent edits. |
| `POST` | `/api/v1/radiologist/worklist/:id/assign` | Admin | Supervising radiologist or admin assigns exam to specific doctor. |
| `POST` | `/api/v1/radiologist/worklist/:id/release` | Radiologist, Admin | Releases assigned study back to general reading queue. |
| `GET` | `/api/v1/radiologist/worklist/:id/report` | Radiologist, Admin | Retrieves reporting workspace context, clinical indications, and previous drafts. |
| `POST` | `/api/v1/radiologist/worklist/:id/report/draft` | Radiologist | Creates report draft pre-populated from structured template. |
| `PATCH` | `/api/v1/radiologist/worklist/:id/report/draft` | Radiologist | Saves manual work-in-progress findings, technique, and impression. |
| `POST` | `/api/v1/radiologist/worklist/:id/report/draft/autosave` | Radiologist | Non-blocking periodic autosave endpoint for draft report text. |
| `POST` | `/api/v1/radiologist/worklist/:id/report/finalize` | Radiologist | Applies electronic signature, finalizes diagnostic report, and locks record (`FINAL`). |
| `POST` | `/api/v1/radiologist/worklist/:id/report/send-to-reception`| Radiologist | Flags finalized report as ready for patient collection at front desk. |
| `GET` | `/api/v1/radiologist/worklist/:id/report/pdf` | Clinicians, Admin | Streams authoritative clinical PDF report with digital signature stamp and QR code. |
| `GET` | `/api/v1/radiologist/worklist/:id/report/version-history` | Radiologist, Admin | Audit log of all edits, prior versions, and amendments. |
| `POST` | `/api/v1/radiologist/worklist/:id/report/amendments` | Radiologist | Creates official clinical addendum or formal amendment on finalized report. |
| `POST` | `/api/v1/radiologist/critical-findings` | Radiologist | Dispatches red alert for life-threatening diagnosis (e.g. intracranial hemorrhage). |
| `GET` | `/api/v1/radiologist/critical-findings` | Radiologist, Admin | Queue of active critical findings and acknowledgment tracking. |
| `POST` | `/api/v1/radiologist/critical-findings/:id/acknowledge`| Clinicians, Admin | Referring clinician or radiologist confirms receipt of critical alert. |
| `POST` | `/api/v1/radiologist/peer-reviews` | Radiologist | Submits randomized or requested peer review case for QA second read. |
| `GET` | `/api/v1/radiologist/peer-reviews` | Radiologist, Admin | Lists peer review cases awaiting evaluation. |
| `POST` | `/api/v1/radiologist/peer-reviews/:id/submit` | Radiologist | Submits peer review score (RADPEER 1–4) and clinical concordance notes. |
| `GET` | `/api/v1/reports/tat` | Radiologist, Admin | Turnaround Time (TAT) analytics from order booking to final report release. |

---

## 11. Billing, Invoicing & Cashiering (`/api/v1/billing`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/billing/prices` | Staff Roles | Full service price master catalog with modality base rates. |
| `POST` | `/api/v1/billing/prices` | Admin | Adds new billable procedure or consumable charge code. |
| `POST` | `/api/v1/billing/quotations` | Reception, Admin | Generates price estimate / quotation for patient prior to scheduling. |
| `GET` | `/api/v1/billing/invoices` | Billing, Reception, Admin | Lists billing invoices with payment status (PENDING, PARTIAL, PAID). |
| `POST` | `/api/v1/billing/invoices` | Billing, Reception, Admin | Generates invoice for patient imaging encounter. |
| `GET` | `/api/v1/billing/invoices/:id` | Billing, Reception, Admin | Fetches invoice itemization, gross amount, discount, and balance. |
| `POST` | `/api/v1/billing/payments` | Billing, Reception, Admin | Records cashier collection (Cash, Card, UPI, NetBanking) and issues receipt. |
| `GET` | `/api/v1/billing/receipts/:id` | Billing, Reception, Admin | Retrieves payment receipt with breakdown of amounts paid in INR. |
| `POST` | `/api/v1/billing/invoices/:id/discount`| Admin, Billing | Applies authorized discount with validation against eligible gross amount. |
| `POST` | `/api/v1/billing/refunds` | Admin, Billing | Processes cancellation refund against previously collected receipts. |
| `POST` | `/api/v1/billing/claims` | Billing, Admin | Submits Third Party Administrator (TPA) / Insurance claim for patient invoice. |
| `GET` | `/api/v1/billing/claims` | Billing, Admin | Lists active TPA claims and reimbursement status. |
| `PATCH` | `/api/v1/billing/claims/:id/status` | Billing, Admin | Updates claim state (SUBMITTED, APPROVED, REJECTED, SETTLED). |
| `POST` | `/api/v1/billing/clinical-charges/attach`| Tech, Billing | Links contrast volume or film sheets consumed during scan to invoice. |
| `GET` | `/api/v1/billing/cashier/summary` | Billing, Admin | Real-time shift drawer summary (Cash, UPI, Card totals) for active cashier. |
| `POST` | `/api/v1/billing/cashier/close` | Billing, Admin | Submits cashier shift closing and locks financial drawer. |
| `GET` | `/api/v1/billing/reports/revenue` | Admin, Billing | Daily, weekly, and monthly revenue analytics in Indian Rupees (INR). |

---

## 12. Consumables & Inventory Management (`/api/v1/inventory`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/inventory/items` | Tech, Admin | Lists stock catalog: contrast media, syringes, catheters, films, and PPE. |
| `POST` | `/api/v1/inventory/items` | Admin | Adds new item master with reorder thresholds and storage unit. |
| `POST` | `/api/v1/inventory/receipts` | Admin, Tech | Records inbound stock delivery with batch/lot number and expiration date. |
| `GET` | `/api/v1/inventory/alerts/expiry` | Tech, Admin | Lists inventory expiring within 30, 60, or 90 days. |
| `GET` | `/api/v1/inventory/fefo-recommendation`| Tech | First-Expired-First-Out (FEFO) dispensing recommendation for contrast batch. |
| `POST` | `/api/v1/inventory/transfers` | Tech, Admin | Transfers consumables between main store and scanner suites (CT/MRI). |
| `POST` | `/api/v1/inventory/contrast/issue` | Tech | Issues specific contrast vial to imaging encounter. |
| `POST` | `/api/v1/inventory/wastage` | Tech, Admin | Logs discarded or expired items with clinical reason. |
| `GET` | `/api/v1/inventory/emergency-register` | Tech, Admin | Crash cart emergency medication checklist (Adrenaline, Antihistamines). |
| `POST` | `/api/v1/inventory/films/usage` | Tech | Records printed physical film sheets consumed for study. |
| `POST` | `/api/v1/inventory/audits` | Admin | Submits periodic physical stock count audit and computes variance. |

---

## 13. Equipment Maintenance & Quality Control (`/api/v1/maintenance`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/maintenance/equipment` | All Staff Roles | Lists all radiology scanners, workstation terminals, and injectors. |
| `POST` | `/api/v1/maintenance/equipment` | Admin | Registers new medical equipment asset and warranty terms. |
| `GET` | `/api/v1/maintenance/schedules` | Tech, Admin | Preventive Maintenance (PM) schedules and upcoming vendor services. |
| `POST` | `/api/v1/maintenance/schedules` | Admin | Schedules routine manufacturer service check. |
| `POST` | `/api/v1/maintenance/qc-checks` | Tech, Admin | Records daily technologist QA/QC check (phantom scan, SNR test, water CT #). |
| `POST` | `/api/v1/maintenance/tickets` | Tech, Admin | Logs equipment breakdown incident or clinical service ticket. |
| `POST` | `/api/v1/maintenance/downtime/start` | Tech, Admin | Flags machine OUT_OF_SERVICE and recalculates appointment schedules. |
| `POST` | `/api/v1/maintenance/downtime/end` | Tech, Admin | Restores machine to OPERATIONAL status after engineer sign-off. |
| `POST` | `/api/v1/maintenance/certificates` | Admin | Uploads AERB / radiation safety calibration certificate. |
| `GET` | `/api/v1/maintenance/analytics` | Admin | Equipment performance metrics: Mean Time Between Failures (MTBF), uptime %. |

---

## 14. External Study Sharing (`/api/v1/external-shares`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/external-shares` | Staff Roles | Generates external share link with cryptographic token and expiration window. |
| `GET` | `/api/v1/external-shares` | Staff Roles | Lists all active and expired external shares. |
| `POST` | `/api/v1/external-shares/:id/revoke` | Staff Roles | Immediately invalidates public access token and revokes access. |
| `POST` | `/api/v1/external-shares/:token/verify-otp` | Public / Recipient | Verifies 6-digit One-Time Password to unlock clinical share session. |
| `GET` | `/api/v1/external-shares/:token/context` | Verified Recipient | Retrieves unlocked study metadata and OHIF viewer launch parameter. |
| `GET` | `/api/v1/external-shares/:token/report-pdf` | Verified Recipient | Downloads finalized signed PDF diagnostic report. |
| `GET` | `/api/v1/external-shares/:token/dicom-package`| Verified Recipient| Downloads complete DICOM image series package as ZIP archive. |

---

## 15. Patient & Referring Clinician Portals (`/api/v1/portal`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/portal/patient/request-otp` | Public | Generates and sends authentication OTP to registered mobile number. |
| `POST` | `/api/v1/portal/patient/verify-otp` | Public | Validates OTP and returns patient access token. |
| `GET` | `/api/v1/portal/patient/examinations` | Public | Lists bookable radiology examinations and patient preparation rules. |
| `GET` | `/api/v1/portal/patient/slots` | Public | Real-time available appointment slots by date and modality. |
| `GET` | `/api/v1/portal/patient/appointments` | Patient | Lists patient's scheduled appointments and completed scan history. |
| `POST` | `/api/v1/portal/patient/book` | Patient | Confirms appointment booking with patient contact and modality details. |
| `GET` | `/api/v1/portal/patient/reports` | Patient | Retrieves list of finalized reports available for authenticated patient. |
| `GET` | `/api/v1/portal/patient/reports/:accession/pdf` | Patient | Secure download of finalized signed PDF report (cross-patient isolated). |
| `GET` | `/api/v1/portal/patient/reports/:accession/viewer`| Patient | Launches secure zero-footprint web viewer for patient's DICOM scan. |
| `POST` | `/api/v1/portal/referring-doctor/login` | Public | Doctor login using verified professional credentials. |
| `GET` | `/api/v1/portal/referring-doctor/reports` | Referring Doctor | Worklist of finalized studies referred by this specific clinician. |

---

## 16. Administration, Security & Compliance (`/api/v1/admin`, `/api/v1/audit-logs`)

| Method | Endpoint | Access / Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | Admin | Lists all hospital RIS accounts with role assignments and active status. |
| `POST` | `/api/v1/admin/users` | Admin | Provisions new clinical staff account with hashed password and role. |
| `PATCH` | `/api/v1/admin/users/:id` | Admin | Modifies user permissions, changes role, or deactivates account. |
| `POST` | `/api/v1/admin/patients/merge` | Admin | Executes merge of duplicate patient records, migrating history and orders. |
| `GET` | `/api/v1/admin/retention/rules` | Admin | DICOM and report data retention policies according to regulatory statutes. |
| `GET` | `/api/v1/admin/backups` | Admin | Reports database backup status and disaster recovery drill logs. |
| `POST` | `/api/v1/admin/backups/trigger` | Admin | Triggers automated application database backup snapshot. |
| `GET` | `/api/v1/audit-logs` | Admin | Immutable query interface for clinical audit logs with date and user filters. |
| `GET` | `/api/v1/health` | Public | Real-time health check reporting API status, uptime, and database latency. |

