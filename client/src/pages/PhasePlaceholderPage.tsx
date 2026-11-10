import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface PhasePlaceholderProps {
  title: string;
  phase: string;
  role: string;
  description: string;
  plannedFeatures: string[];
}

export function PhasePlaceholderPage({
  title,
  phase,
  role,
  description,
  plannedFeatures,
}: PhasePlaceholderProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-base font-bold tracking-tight text-slate-900">{title}</h1>
            <Badge variant="cyan">{phase}</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Designated for upcoming implementation phase | Primary Role: <span className="font-semibold">{role}</span>
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-cyan-600" />
            <span>Phase Roadmap Specification</span>
          </div>
          <CardTitle className="text-base text-slate-900 mt-1">{title} Architecture</CardTitle>
          <CardDescription className="text-xs text-slate-600">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Planned Deliverables for {phase}:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {plannedFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center text-xs text-slate-500">
            <span>Phase 1 database models and REST router endpoints are already in place.</span>
            <Link to="/workflow">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <span>View Full RIS Workflow</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

