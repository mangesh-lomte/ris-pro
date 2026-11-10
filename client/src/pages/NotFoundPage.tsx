import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-slate-200 text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Resource Not Found</h2>
          <p className="text-xs text-slate-500">
            The requested radiology page or clinical view does not exist in the current RIS routing table.
          </p>
          <div className="pt-2">
            <Link to="/dashboard">
              <Button variant="clinical" size="sm" className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Executive Dashboard</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

