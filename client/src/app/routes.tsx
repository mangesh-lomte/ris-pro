import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { HealthPage } from '../pages/HealthPage';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientDetailPage } from '../pages/PatientDetailPage';
import { OrdersPage } from '../pages/OrdersPage';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { ReceptionQueuePage } from '../pages/ReceptionQueuePage';
import { TechnologistWorklistPage } from '../pages/TechnologistWorklistPage';
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
        path: '/patients/:id',
        element: <PatientDetailPage />,
      },
      {
        path: '/orders',
        element: <OrdersPage />,
      },
      {
        path: '/appointments',
        element: (
          <ProtectedRoute allowedRoles={['RECEPTION', 'ADMIN']}>
            <AppointmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reception',
        element: (
          <ProtectedRoute allowedRoles={['RECEPTION', 'ADMIN']}>
            <ReceptionQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/health',
        element: <HealthPage />,
      },

      // Technologist Worklist (Phases 3.1 - 3.7)
      {
        path: '/technologist',
        element: (
          <ProtectedRoute allowedRoles={['TECHNOLOGIST', 'ADMIN']}>
            <TechnologistWorklistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/technologist/worklist',
        element: (
          <ProtectedRoute allowedRoles={['TECHNOLOGIST', 'ADMIN']}>
            <TechnologistWorklistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/worklist',
        element: <Navigate to="/technologist/worklist" replace />,
      },
      {
        path: '/reporting',
        element: (
          <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
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
          </ProtectedRoute>
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

