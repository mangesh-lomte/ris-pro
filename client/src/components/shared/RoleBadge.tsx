import { UserRole } from '../../types';
import { Badge } from '../ui/badge';
import { ShieldCheck, UserCog, Stethoscope, Sliders } from 'lucide-react';

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  switch (role) {
    case 'ADMIN':
      return (
        <Badge variant="outline" className={`bg-purple-50 text-purple-700 border-purple-200 gap-1 ${className}`}>
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          <span>ADMIN</span>
        </Badge>
      );
    case 'RECEPTION':
      return (
        <Badge variant="outline" className={`bg-blue-50 text-blue-700 border-blue-200 gap-1 ${className}`}>
          <UserCog className="w-3 h-3 text-blue-600" />
          <span>RECEPTION</span>
        </Badge>
      );
    case 'TECHNOLOGIST':
      return (
        <Badge variant="outline" className={`bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 ${className}`}>
          <Sliders className="w-3 h-3 text-emerald-600" />
          <span>TECHNOLOGIST</span>
        </Badge>
      );
    case 'RADIOLOGIST':
      return (
        <Badge variant="outline" className={`bg-amber-50 text-amber-800 border-amber-300 gap-1 ${className}`}>
          <Stethoscope className="w-3 h-3 text-amber-600" />
          <span>RADIOLOGIST</span>
        </Badge>
      );
  }
}
