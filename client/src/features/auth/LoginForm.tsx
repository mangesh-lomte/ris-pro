import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { RoleBadge } from '../../components/shared/RoleBadge';
import { AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid hospital email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login, quickLoginAsRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'reception@ris.local',
      password: 'Demo@123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setErrorMessage(null);
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed');
      }
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    try {
      setLoadingRole(role);
      setErrorMessage(null);
      await quickLoginAsRole(role);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Quick sign-in failed');
      }
    } finally {
      setLoadingRole(null);
    }
  };

  const demoAccounts: { role: UserRole; name: string; email: string }[] = [
    { role: 'RECEPTION', name: 'Sarah Jenkins', email: 'reception@ris.local' },
    { role: 'TECHNOLOGIST', name: 'Marcus Vance, RT', email: 'tech@ris.local' },
    { role: 'RADIOLOGIST', name: 'Dr. Elena Rostova', email: 'rad@ris.local' },
    { role: 'ADMIN', name: 'Dr. Arthur Evans', email: 'admin@ris.local' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-slate-800/10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Hospital Email
            </label>
            <Input
              type="email"
              placeholder="e.g. reception@ris.local"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <span className="text-[11px] text-slate-400">Demo: Demo@123</span>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            variant="clinical"
            className="w-full h-10 text-sm font-semibold"
            isLoading={isSubmitting}
          >
            <span>Sign In to RIS Portal</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        {/* Quick 1-Click Role Switcher for Interviewers */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span>1-Click Role Evaluation Demo</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Select any role below to instantly authenticate and evaluate role-specific workflows:
          </p>

          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickLogin(acc.role)}
                disabled={loadingRole !== null || isSubmitting}
                className="flex flex-col items-start p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-cyan-50/50 hover:border-cyan-300 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <RoleBadge role={acc.role} />
                  {loadingRole === acc.role && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-900 group-hover:text-cyan-900 leading-tight">
                  {acc.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate w-full">
                  {acc.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
