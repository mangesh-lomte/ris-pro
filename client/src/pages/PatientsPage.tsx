import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPatients, generatePatientIdPreview } from '../services/patientService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { calculateAge, formatDate } from '../utils/formatters';
import { Search, Sparkles, Phone, Mail, ShieldAlert } from 'lucide-react';

export function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', { search: searchTerm }],
    queryFn: () => fetchPatients({ search: searchTerm }),
  });

  const handleGenerateNextId = async () => {
    try {
      setGenerating(true);
      const res = await generatePatientIdPreview();
      setPreviewId(res.patientId);
    } finally {
      setGenerating(false);
    }
  };

  const patients = data?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Master Patient Index (MPI)
            </h1>
            <Badge variant="cyan">Patient Registry</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Persistent Patient ID (MRN) management — Single source of truth for patient identity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateNextId}
            isLoading={generating}
            className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generate Next MRN</span>
          </Button>
        </div>
      </div>

      {previewId && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
              MRN
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">Next Sequence Patient ID Generated</p>
              <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                Value: <span className="font-bold underline">{previewId}</span> (Format: PAT-YYYY-XXXXX)
              </p>
            </div>
          </div>
          <IdentifierPill type="patient" value={previewId} />
        </div>
      )}

      {/* Patient Registry Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by MRN, name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldAlert className="w-4 h-4 text-cyan-600" />
              <span>Age calculated dynamically from DOB (never stored as raw age)</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No patients found matching current criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persistent Patient ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Demographics</TableHead>
                  <TableHead>Contact Details</TableHead>
                  <TableHead>Emergency Contact</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const age = calculateAge(patient.dateOfBirth);
                  return (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <IdentifierPill type="patient" value={patient.patientId} />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">
                          {patient.lastName}, {patient.firstName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {patient.address || 'Address unrecorded'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800 text-xs">
                            {age} yrs
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-[11px] text-slate-500">
                            DOB: {formatDate(patient.dateOfBirth)}
                          </span>
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {patient.gender}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-[11px]">{patient.phone}</span>
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{patient.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {patient.emergencyContact || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(patient.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
