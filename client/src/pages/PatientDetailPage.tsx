import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPatient } from '../services/patientService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { StatusBadge } from '../components/shared/StatusBadge';
import { calculateAge, formatDate } from '../utils/formatters';
import {
  ArrowLeft,
  FilePlus,
  Edit,
  Printer,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { EditDemographicsModal } from '../features/patients/EditDemographicsModal';
import { CreateOrderModal } from '../features/orders/CreateOrderModal';
import { BookAppointmentModal } from '../features/scheduling/BookAppointmentModal';
import { RescheduleAppointmentModal } from '../features/scheduling/RescheduleAppointmentModal';
import { CancelAppointmentModal } from '../features/scheduling/CancelAppointmentModal';
import { ReceptionCheckInModal } from '../features/reception/ReceptionCheckInModal';
import { PatientLabelModal } from '../components/shared/PatientLabelModal';
import { Appointment, ImagingOrder } from '../types';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [editDemoOpen, setEditDemoOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [bookApptOpen, setBookApptOpen] = useState(false);
  const [selectedOrderForBooking, setSelectedOrderForBooking] = useState<ImagingOrder | undefined>(undefined);

  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [cancelModalData, setCancelModalData] = useState<{ appt: Appointment; type: 'CANCEL' | 'NO_SHOW' } | null>(null);
  const [checkInAppt, setCheckInAppt] = useState<Appointment | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Patient Record Not Found</h2>
        <p className="text-xs text-slate-500">The requested patient identifier does not exist in the Master Patient Index.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/patients')}>
          Return to Patient Index
        </Button>
      </div>
    );
  }

  const age = calculateAge(patient.dateOfBirth);
  const orders = patient.imagingOrders || [];
  const appointments = patient.appointments || [];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-12">
      {/* Back button and page breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/patients')}
          className="text-xs gap-1.5 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Master Patient Index</span>
        </Button>
      </div>

      {/* Patient Master Demographics Card */}
      <Card className="border-[#DCE2EC] overflow-hidden shadow-card rounded-2xl">
        <div className="bg-[#172554] p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {patient.lastName}, {patient.firstName} {patient.middleName || ''}
              </h1>
              <Badge variant="cyan" className="font-mono text-xs font-semibold">
                {patient.patientId}
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700 text-xs capitalize">
                {patient.gender.toLowerCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
              <span>
                DOB: <strong className="text-white">{formatDate(patient.dateOfBirth)}</strong> ({age} years old)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-cyan-400" />
                {patient.phone}
              </span>
              {patient.email && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-cyan-400" />
                    {patient.email}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditDemoOpen(true)}
              className="text-xs bg-slate-800 border-slate-700 text-white hover:bg-slate-700 gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Demographics</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLabelModalOpen(true)}
              className="text-xs bg-slate-800 border-slate-700 text-white hover:bg-slate-700 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wristband</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOrderOpen(true)}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>New Imaging Order</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50 p-4 text-xs text-slate-700">
          <div className="flex items-start gap-2.5 pb-2 sm:pb-0">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Address</span>
              <span>
                {patient.addressLine1
                  ? `${patient.addressLine1}${patient.city ? `, ${patient.city}` : ''} ${patient.state || ''} ${patient.postalCode || ''}`
                  : 'No street address on record'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 py-2 sm:py-0 sm:px-4">
            <UserCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Emergency Contact</span>
              <span>
                {patient.emergencyContactName
                  ? `${patient.emergencyContactName} (${patient.emergencyContactRelation || 'Contact'}) — ${patient.emergencyContactPhone || 'No phone'}`
                  : 'None listed'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 sm:pt-0 sm:px-4">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Master Patient Index Status</span>
              <span className="text-emerald-700 font-semibold">Active & Verified Identifier</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs for Clinical History */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="orders" className="text-xs">
            Imaging Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="text-xs">
            Scheduled Appointments ({appointments.length})
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Patient Imaging Orders</h3>
                <p className="text-xs text-slate-500">
                  Accession numbers linked permanently to this patient record
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateOrderOpen(true)}
                className="text-xs bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>Create Order</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No imaging orders recorded for this patient yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Accession #</TableHead>
                      <TableHead>Modality</TableHead>
                      <TableHead>Examination</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Referring Doctor</TableHead>
                      <TableHead>Order Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: ImagingOrder) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <IdentifierPill type="accession" value={o.accessionNumber} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {o.modality}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {o.examinationName}
                          <span className="block text-[11px] text-slate-400">{o.bodyPart}</span>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={o.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={o.orderStatus} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {o.referringDoctor?.name || 'Internal / Hospital'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(o.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Patient Appointments & Queue History</h3>
                <p className="text-xs text-slate-500">
                  Scheduled time slots, assigned scanners, and waiting room tokens
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {appointments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No appointments scheduled for this patient.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Appt #</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Modality & Room</TableHead>
                      <TableHead>Examination</TableHead>
                      <TableHead>Queue Token</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt: Appointment) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {apt.appointmentNumber}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium text-slate-900 block">
                            {new Date(apt.scheduledStart).toLocaleDateString()}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {new Date(apt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(apt.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="mr-1.5 font-mono text-[11px]">
                            {apt.modality}
                          </Badge>
                          <span className="text-slate-700">{apt.equipment?.name || apt.location || 'Suite'}</span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {apt.examination}
                        </TableCell>
                        <TableCell>
                          {apt.tokenNumber ? (
                            <Badge variant="cyan" className="font-mono font-bold text-xs">
                              {apt.tokenNumber}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={apt.status} />
                        </TableCell>
                        <TableCell className="text-right space-x-1.5">
                          {apt.status === 'SCHEDULED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                onClick={() => setCheckInAppt(apt)}
                              >
                                Check In
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-slate-300 hover:bg-slate-100"
                                onClick={() => setRescheduleAppt(apt)}
                              >
                                Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => setCancelModalData({ appt: apt, type: 'CANCEL' })}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connected Modals */}
      <EditDemographicsModal
        open={editDemoOpen}
        onOpenChange={setEditDemoOpen}
        patient={patient}
      />

      <CreateOrderModal
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        patient={patient}
        onScheduleOrder={(ord) => {
          setSelectedOrderForBooking(ord);
          setBookApptOpen(true);
        }}
      />

      {selectedOrderForBooking && (
        <BookAppointmentModal
          open={bookApptOpen}
          onOpenChange={setBookApptOpen}
          order={selectedOrderForBooking}
          patient={patient}
        />
      )}

      {rescheduleAppt && (
        <RescheduleAppointmentModal
          open={!!rescheduleAppt}
          onOpenChange={(op) => !op && setRescheduleAppt(null)}
          appointment={rescheduleAppt}
        />
      )}

      {cancelModalData && (
        <CancelAppointmentModal
          open={!!cancelModalData}
          onOpenChange={(op) => !op && setCancelModalData(null)}
          appointment={cancelModalData.appt}
          actionType={cancelModalData.type}
        />
      )}

      {checkInAppt && (
        <ReceptionCheckInModal
          open={!!checkInAppt}
          onOpenChange={(op) => !op && setCheckInAppt(null)}
          appointment={checkInAppt}
        />
      )}

      <PatientLabelModal
        open={labelModalOpen}
        onOpenChange={setLabelModalOpen}
        patient={{
          patientId: patient.patientId,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
        }}
      />
    </div>
  );
}
