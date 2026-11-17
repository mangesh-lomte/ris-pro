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
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Patient Master Index (PMI)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Central demographic registry &amp; MRN management — Authoritative clinical identity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateNextId}
            isLoading={generating}
            className="text-xs font-bold gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-full px-3.5 py-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Preview Next MRN</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shadow-soft rounded-full px-4 py-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Register Patient</span>
          </Button>
        </div>
      </div>

      {previewId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
              MRN
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">Next Sequence Patient MRN Preview</p>
              <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                Format: <span className="font-bold underline">{previewId}</span> (PAT-YYYY-XXXXX)
              </p>
            </div>
          </div>
          <IdentifierPill type="patient" value={previewId} />
        </div>
      )}

      {/* Patient Registry Card */}
      <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white overflow-hidden">
        <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Filter by MRN, patient name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs rounded-full border-[#dce6e0] bg-[#f8faf8] focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px]">Age verified &amp; auto-calculated from DOB</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              No patient records found matching current query.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#e9f1ed] bg-[#f8faf8]">
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Name</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">MRN</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demographics</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered</TableHead>
                  <TableHead className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const age = calculateAge(patient.dateOfBirth);
                  return (
                    <TableRow key={patient.id} className="hover:bg-[#f8faf8] transition-colors border-b border-[#f0f4f1]">
                      <TableCell className="py-3 px-4">
                        <Link
                          to={`/patients/${patient.patientId}`}
                          className="font-bold text-slate-900 text-xs hover:text-emerald-700 block"
                        >
                          {patient.lastName}, {patient.firstName} {patient.middleName || ''}
                        </Link>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {patient.emergencyContactName ? `Contact: ${patient.emergencyContactName}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <IdentifierPill type="patient" value={patient.patientId} />
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs font-mono">
                            {age}y
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formatDate(patient.dateOfBirth)}
                          </span>
                          <Badge variant="outline" className="text-[10px] ml-1 py-0.5 px-2 rounded-full border-slate-200 bg-slate-50 text-slate-700 font-bold">
                            {patient.gender}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="space-y-0.5 text-xs text-slate-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-[11px]">{patient.phone}</span>
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[130px]">{patient.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-slate-600 font-medium">
                        {patient.city ? `${patient.city}, ${patient.state || ''}` : patient.address || '—'}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-slate-500 font-medium">
                        {formatDate(patient.createdAt)}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs font-bold gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
                            onClick={() => navigate(`/patients/${patient.patientId}`)}
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs font-bold gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-full"
                            onClick={() => setOrderModalPatient(patient)}
                          >
                            <FilePlus className="w-3 h-3 text-emerald-600" />
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
