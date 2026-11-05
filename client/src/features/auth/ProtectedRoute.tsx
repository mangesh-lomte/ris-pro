import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types';
import { RoleBadge } from '../../components/shared/RoleBadge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Verifying healthcare credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="max-w-md w-full border-rose-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-rose-900 text-base font-bold">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm font-semibold text-slate-800">
              You do not have permission to access this page.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your current active role is not authorized to access this section of the RIS.
            </p>
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-xs text-slate-500">Current Role:</span>
              <RoleBadge role={user.role} />
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Required Role(s): <span className="font-semibold text-slate-700">{allowedRoles.join(', ')}</span>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button variant="clinical" onClick={() => window.location.href = '/dashboard'}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

