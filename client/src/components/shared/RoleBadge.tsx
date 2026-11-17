import { UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { ShieldCheck, UserCog, Stethoscope, Sliders } from 'lucide-react';

const roleConfig: Record<UserRole, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  ADMIN:        { label: 'Admin',        icon: ShieldCheck,  cls: 'bg-slate-900 text-white border-transparent' },
  RECEPTION:    { label: 'Reception',    icon: UserCog,      cls: 'bg-sky-100 text-sky-800 border-sky-200/60' },
  TECHNOLOGIST: { label: 'Technologist', icon: Sliders,      cls: 'bg-emerald-100 text-emerald-800 border-emerald-200/60' },
  RADIOLOGIST:  { label: 'Radiologist',  icon: Stethoscope,  cls: 'bg-purple-100 text-purple-800 border-purple-200/60' },
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const { label, icon: Icon, cls } = roleConfig[role] ?? roleConfig['ADMIN'];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold leading-none select-none shadow-2xs',
        cls,
        className
      )}
    >
      <Icon className="w-2.5 h-2.5 shrink-0 opacity-80" aria-hidden="true" />
      {label}
    </span>
  );
}
