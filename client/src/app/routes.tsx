import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { HealthPage } from '../pages/HealthPage';
import { PatientsPage } from '../pages/PatientsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PhasePlaceholderPage } from '../pages/PhasePlaceholderPage';

export const router = createBrowserRouter([
  // Public Auth Route
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },

  // Protected Clinical Application Routes
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/workflow',
        element: <WorkflowPage />,
      },
      {
        path: '/patients',
        element: <PatientsPage />,
      },
      {
        path: '/orders',
        element: <OrdersPage />,
      },
      {
        path: '/health',
        element: <HealthPage />,
      },

      // Future Phase Pipeline Pages
      {
        path: '/appointments',
        element: (
          <PhasePlaceholderPage
            title="Scheduling & Multi-Modality Calendar"
            phase="Phase 2"
            role="RECEPTION"
            description="Dynamic appointment booking, room and scanner allocation, double-booking prevention, and patient arrival check-in."
            plannedFeatures={[
              'Multi-modality scanner calendar (CT, MRI, X-Ray)',
              'Slot double-booking prevention at database transaction level',
              'Patient arrival marking & automated status change to ARRIVED',
              'Pre-scan checklist verification (fasting, prep instructions)',
            ]}
          />
        ),
      },
      {
        path: '/worklist',
        element: (
          <PhasePlaceholderPage
            title="Technologist Console & Modality Worklist (MWL)"
            phase="Phase 2"
            role="TECHNOLOGIST"
            description="Real-time exam worklist, patient identity safety verification, contrast media tracking, and PACS dispatch."
            plannedFeatures={[
              'Patient identity double-verification at scanner bedside',
              'Clinical safety screening (pacemakers, implants, eGFR / creatinine)',
              'Contrast administration telemetry (agent, lot, volume, adverse events)',
              'Acquisition start/finish timestamps & DICOM C-STORE push trigger',
            ]}
          />
        ),
      },
      {
        path: '/reporting',
        element: (
          <PhasePlaceholderPage
            title="Diagnostic Reporting & Radiologist Locker"
            phase="Phase 3"
            role="RADIOLOGIST"
            description="Structured diagnostic reporting with findings, impression, electronic attestation, and versioned addendums."
            plannedFeatures={[
              'Radiologist claiming lock preventing dual dictation',
              'Structured clinical reporting (technique, findings, impression)',
              'Electronic signature attestation with SHA-256 integrity hash',
              'Historical revision tracking & addendum support',
            ]}
          />
        ),
      },
      {
        path: '/billing',
        element: (
          <PhasePlaceholderPage
            title="OPD Billing & Payment Settlement"
            phase="Phase 4"
            role="RECEPTION / BILLING"
            description="Automatic invoice generation linked to order accession number, itemized fee schedules, and receipt generation."
            plannedFeatures={[
              'Automated invoice generation per accession number',
              'Copay, discount, and multi-tender payments (Cash, Card, Insurance)',
              'Outstanding balance tracking and receipt printouts',
              'Financial audit reconciliation reports',
            ]}
          />
        ),
      },
      {
        path: '/audit-trail',
        element: (
          <PhasePlaceholderPage
            title="Security Audit & Compliance Trail"
            phase="Phase 1 & 2"
            role="ADMIN"
            description="Tamper-evident record of all patient data access, authentication events, and clinical status changes."
            plannedFeatures={[
              'HIPAA-compliant read & mutation access logs',
              'User ID, role, client IP address, and timestamp binding',
              'Exportable compliance audit reports',
              'System security alerts and threshold alarms',
            ]}
          />
        ),
      },

      // 404 Wildcard
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
