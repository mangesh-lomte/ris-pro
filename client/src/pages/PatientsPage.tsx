import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { fetchPatients, generatePatientIdPreview } from '../services/patientService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { calculateAge, formatDate } from '../utils/formatters';
import { Search, Sparkles, Phone, Mail, ShieldAlert, UserPlus, Eye, FilePlus } from 'lucide-react';
import { RegisterPatientModal } from '../features/patients/RegisterPatientModal';
import { CreateOrderModal } from '../features/orders/CreateOrderModal';
import { Patient } from '../types';

export function PatientsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [orderModalPatient, setOrderModalPatient] = useState<Patient | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', { search: searchTerm }],
    queryFn: () => fetchPatients({ search: searchTerm, pageSize: 100 }),
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

  const rawPatients = data?.data?.items || [];
  const filtered = rawPatients.filter((p) => {
    if (searchTerm.trim()) return true;
    const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    const mrn = (p.patientId || '').toLowerCase();
    if (name.includes('tester') || name.includes('walkin') || mrn.includes('test')) {
      return false;
    }
    return true;
  });
  const patients = filtered.length > 0 ? filtered : rawPatients;

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE2EC]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">
            Master Patient Index (MPI)
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Persistent Patient ID (MRN) management — Single source of truth for patient identity
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateNextId}
            isLoading={generating}
            className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generate Next MRN</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="text-xs bg-[#174A70] hover:bg-[#123855] text-white gap-1.5 shadow-2xs rounded-md"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register New Patient</span>
          </Button>
        </div>
      </div>

      {previewId && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-3.5 flex items-center justify-between animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white font-bold text-xs">
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
      <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
        <CardHeader className="p-3.5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by MRN, name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs rounded-md"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldAlert className="w-3.5 h-3.5 text-[#174A70]" />
              <span className="text-[11px]">Age dynamically computed from DOB (never stored as raw integer)</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#174A70] border-t-transparent" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No patients found matching current criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/70 hover:bg-slate-50/70">
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Patient Name</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">MRN</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Demographics</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Location</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registered</TableHead>
                  <TableHead className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const age = calculateAge(patient.dateOfBirth);
                  return (
                    <TableRow key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="py-2.5 px-3">
                        <Link
                          to={`/patients/${patient.patientId}`}
                          className="font-semibold text-[#152B42] text-xs hover:text-[#174A70] hover:underline block"
                        >
                          {patient.lastName}, {patient.firstName} {patient.middleName || ''}
                        </Link>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {patient.emergencyContactName ? `Contact: ${patient.emergencyContactName}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <IdentifierPill type="patient" value={patient.patientId} />
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#152B42] text-xs tabular-nums">
                            {age}y
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {formatDate(patient.dateOfBirth)}
                          </span>
                          <Badge variant="outline" className="text-[10px] ml-1 py-0 px-1.5">
                            {patient.gender}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <div className="space-y-0.5 text-xs text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-[11px] tabular-nums">{patient.phone}</span>
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[140px]">{patient.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-xs text-slate-600">
                        {patient.city ? `${patient.city}, ${patient.state || ''}` : patient.address || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-xs text-slate-500 tabular-nums">
                        {formatDate(patient.createdAt)}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            onClick={() => navigate(`/patients/${patient.patientId}`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 border-[#174A70]/30 text-[#174A70] hover:bg-[#174A70]/10 rounded-md"
                            onClick={() => setOrderModalPatient(patient)}
                          >
                            <FilePlus className="w-3.5 h-3.5 text-[#174A70]" />
                            <span>Order</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Registration Modal */}
      <RegisterPatientModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onPatientCreated={(newPatient) => {
          navigate(`/patients/${newPatient.patientId}`);
        }}
        onSelectExisting={(candidate) => {
          navigate(`/patients/${candidate.patientId}`);
        }}
      />

      {/* Quick Order Modal */}
      {orderModalPatient && (
        <CreateOrderModal
          open={!!orderModalPatient}
          onOpenChange={(op) => !op && setOrderModalPatient(null)}
          patient={orderModalPatient}
          onOrderCreated={() => {
            setOrderModalPatient(null);
          }}
        />
      )}
    </div>
  );
}
