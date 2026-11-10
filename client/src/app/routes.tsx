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
import { RadiologistWorklistPage } from '../pages/RadiologistWorklistPage';
import { ReportingPage } from '../pages/ReportingPage';
import { BillingPage } from '../pages/BillingPage';
import { InventoryPage } from '../pages/InventoryPage';
import { MaintenancePage } from '../pages/MaintenancePage';
import { ExternalSharePage } from '../pages/ExternalSharePage';
import { AdminPage } from '../pages/AdminPage';
import { SharedStudyRecipientPortal } from '../features/externalShare/SharedStudyRecipientPortal';
import { PatientPortalPage } from '../pages/PatientPortalPage';
import { NotFoundPage } from '../pages/NotFoundPage';

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

  // Public Recipient Diagnostic Share Route (Protected by cryptographic token + optional OTP)
  {
    path: '/share/:token',
    element: <SharedStudyRecipientPortal />,
  },

  // Public Patient Portal Route (Self-service online booking & patient records)
  {
    path: '/patient-portal',
    element: <PatientPortalPage />,
  },

  // Public Diagnostic Viewer Relay (Redirect to configured OHIF instance)
  {
    path: '/viewer/:studyInstanceUid',
    loader: ({ params }) => {
      const ohifBase = (((import.meta as any).env?.VITE_OHIF_BASE_URL as string) || 'http://localhost:3000').replace(/\/+$/, '');
      const uid = params.studyInstanceUid || '';
      window.location.replace(`${ohifBase}/viewer?StudyInstanceUIDs=${encodeURIComponent(uid)}`);
      return null;
    },
    element: (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-300">Connecting to OHIF Diagnostic Viewer...</p>
        </div>
      </div>
    ),
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
      // Radiologist Worklist (Phase 4.1)
      {
        path: '/radiologist',
        element: (
          <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
            <RadiologistWorklistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/radiologist/worklist',
        element: (
          <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
            <RadiologistWorklistPage />
          </ProtectedRoute>
        ),
      },
      // Diagnostic Reporting Workspace (P0 Dedicated Route)
      {
        path: '/reporting',
        element: (
          <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
            <ReportingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reporting/:orderId',
        element: (
          <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
            <ReportingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/billing',
        element: (
          <ProtectedRoute allowedRoles={['RECEPTION', 'ADMIN']}>
            <BillingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/inventory',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'TECHNOLOGIST', 'RECEPTION']}>
            <InventoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/maintenance',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'TECHNOLOGIST', 'RECEPTION']}>
            <MaintenancePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/external-shares',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN', 'RADIOLOGIST', 'RECEPTION', 'TECHNOLOGIST']}>
            <ExternalSharePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/audit-trail',
        element: (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminPage />
          </ProtectedRoute>
        ),
      },

      // 404 Wildcard inside App Layout
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },

  // 404 Catch-All outside App Layout
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

