import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { RoleBadge } from '../../components/shared/RoleBadge';
import { AlertCircle, ArrowRight, KeyRound, Mail, Sparkles } from 'lucide-react';
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
    <div className="w-full">
      <div className="rounded-3xl sm:rounded-4xl bg-white/95 backdrop-blur-xl p-5 sm:p-7 shadow-soft border border-[#dce6e0] relative">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Hospital Staff Email
            </label>
            <div className="relative">
              <Input
                type="email"
                placeholder="e.g. reception@ris.local"
                error={errors.email?.message}
                className="h-10 pl-9 rounded-full bg-[#f4f7f5] hover:bg-[#edf2ee] focus:bg-white text-xs font-medium border-slate-200/80 text-slate-800"
                {...register('email')}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                Demo: Demo@123
              </span>
            </div>
            <div className="relative">
              <Input
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                className="h-10 pl-9 rounded-full bg-[#f4f7f5] hover:bg-[#edf2ee] focus:bg-white text-xs font-medium border-slate-200/80 text-slate-800 font-mono"
                {...register('password')}
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-soft transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            isLoading={isSubmitting}
          >
            <span>Sign In to Clinical Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {/* 1-Click Role Switch for Demo / Evaluation */}
        <div className="mt-5 pt-4 border-t border-[#e2ece5]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              1-Click Role Switch
            </span>
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Instant evaluation
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2.5 font-medium">
            Select an account to test role-specific clinical permissions:
          </p>

          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickLogin(acc.role)}
                disabled={loadingRole !== null || isSubmitting}
                className="flex flex-col items-start p-2.5 rounded-2xl border border-[#dce6e0] bg-[#f8faf8] hover:bg-white hover:border-emerald-300 hover:shadow-soft transition-all duration-150 text-left cursor-pointer group active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <RoleBadge role={acc.role} />
                  {loadingRole === acc.role ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  ) : (
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 truncate w-full">
                  {acc.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 truncate w-full">
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
