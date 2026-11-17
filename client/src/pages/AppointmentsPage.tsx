import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchAppointments, fetchSlotAvailability } from '../services/appointmentService';
import { fetchEquipment } from '../services/clinicalMasterService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ModalityType, Appointment, Equipment, SlotCandidate } from '../types';
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  Printer,
  Monitor,
  Users,
} from 'lucide-react';

import { BookAppointmentModal } from '../features/scheduling/BookAppointmentModal';
import { RescheduleAppointmentModal } from '../features/scheduling/RescheduleAppointmentModal';
import { CancelAppointmentModal } from '../features/scheduling/CancelAppointmentModal';
import { ReceptionCheckInModal } from '../features/reception/ReceptionCheckInModal';
import { PatientLabelModal } from '../components/shared/PatientLabelModal';
import { StaffAllocationModal } from '../features/scheduling/StaffAllocationModal';
import { toLocalDateString } from '../utils/formatters';

export function AppointmentsPage() {
  const todayStr = toLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedModality, setSelectedModality] = useState<ModalityType | undefined>('MRI');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  // Modal states
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<{
    date: string;
    time: string;
    equipmentId?: string;
  } | null>(null);

  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [cancelModalData, setCancelModalData] = useState<{ appt: Appointment; type: 'CANCEL' | 'NO_SHOW' } | null>(null);
  const [checkInAppt, setCheckInAppt] = useState<Appointment | null>(null);
  const [labelAppt, setLabelAppt] = useState<Appointment | null>(null);
  const [allocateAppt, setAllocateAppt] = useState<Appointment | null>(null);

  // Equipment List
  const { data: equipmentList = [] } = useQuery<Equipment[]>({
    queryKey: ['equipment', selectedModality],
    queryFn: () => fetchEquipment({ modality: selectedModality }),
  });

  // Slot Availability Matrix
  const { data: availabilityData, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ['availability', selectedModality, selectedDate],
    queryFn: () =>
      fetchSlotAvailability({
        modality: selectedModality || 'MRI',
        date: selectedDate,
        equipmentId: selectedEquipmentId || undefined,
      }),
    enabled: !!selectedModality && !!selectedDate,
  });

  // Appointments List
  const { data: appointmentsData, isLoading: isApptsLoading } = useQuery({
    queryKey: ['appointments', selectedDate, selectedModality, selectedEquipmentId],
    queryFn: () =>
      fetchAppointments({
        date: selectedDate,
        modality: selectedModality,
        equipmentId: selectedEquipmentId || undefined,
        pageSize: 100,
      }),
  });

  const appointments = appointmentsData?.data?.items || [];
  const slots = availabilityData?.slots || [];
  const machines = equipmentList;

  const handleSlotClick = (slotStart: string, eqId?: string) => {
    const time = new Date(slotStart).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    setSelectedSlotForBooking({
      date: selectedDate,
      time,
      equipmentId: eqId,
    });
    setBookModalOpen(true);
  };

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Clinical Calendar &amp; Scanner Scheduling
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Modality suite allocation, double-booking prevention, and real-time slot availability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setSelectedSlotForBooking(null);
              setBookModalOpen(true);
            }}
            className="gap-1.5 px-4 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-soft"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border border-[#dce6e0] shadow-soft p-4 rounded-3xl bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                Date:
              </span>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1 px-3 text-xs font-semibold w-36 rounded-full border-[#dce6e0] bg-[#f8faf8]"
              />
            </div>

            <div role="group" aria-label="Filter by Modality" className="flex items-center gap-1 bg-[#f0f4f1] p-1 rounded-full">
              {(['MRI', 'CT', 'XRAY'] as ModalityType[]).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  aria-pressed={selectedModality === mod}
                  onClick={() => {
                    setSelectedModality(mod);
                    setSelectedEquipmentId('');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${selectedModality === mod
                    ? 'bg-slate-900 text-white shadow-soft font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            {equipmentList.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  Scanner:
                </span>
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  className="rounded-full border border-[#dce6e0] bg-[#f8faf8] px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold cursor-pointer"
                >
                  <option value="">All Scanners in Modality</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.location || 'Suite'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div role="group" aria-label="View Mode" className="flex rounded-full border border-[#dce6e0] bg-[#f0f4f1] p-1 text-xs">
              <button
                type="button"
                aria-pressed={viewMode === 'timeline'}
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${viewMode === 'timeline' ? 'bg-slate-900 text-white shadow-soft' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Slot Timeline
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-soft' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                List View ({appointments.length})
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main View Area */}
      {viewMode === 'timeline' ? (
        <Card className="border border-[#dce6e0] shadow-soft rounded-3xl bg-white overflow-hidden">
          <CardHeader className="p-5 border-b border-[#e9f1ed] flex flex-row items-center justify-between bg-white">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Real-Time Scanner Capacity &amp; Slot Availability
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Operating hours 08:00 – 18:00 with conflict validation against booked equipment windows
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Available Slot
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Scheduled Window
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            {isAvailabilityLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              </div>
            ) : machines.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-medium">
                No active equipment configured for modality {selectedModality}.
              </div>
            ) : (
              <div className="space-y-4">
                {(machines as Equipment[]).map((machine: Equipment) => {
                  const machineSlots = (slots as SlotCandidate[]).filter((s: SlotCandidate) => s.equipmentId === machine.id);
                  return (
                    <div key={machine.id} className="rounded-2xl border border-[#dce6e0] p-4 space-y-3 bg-[#f8faf8]/70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{machine.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono rounded-full border-slate-200">
                            {machine.location || 'Suite'}
                          </Badge>
                          <Badge variant={machine.status === 'OPERATIONAL' ? 'success' : 'secondary'} className="text-[10px] rounded-full">
                            {machine.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono font-medium">
                          {machineSlots.filter((s: SlotCandidate) => s.available).length} slots available today
                        </span>
                      </div>

                      {/* Slot Pills Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {machineSlots.map((slot: SlotCandidate, idx: number) => {
                          const slotTime = new Date(slot.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          });
                          const isAvail = slot.available;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => isAvail && handleSlotClick(slot.start, slot.equipmentId)}
                              disabled={!isAvail}
                              className={`rounded-xl p-2.5 text-left transition border text-xs ${isAvail
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer shadow-soft'
                                : 'bg-amber-50/70 border-amber-200 text-amber-950 opacity-90 cursor-not-allowed'
                                }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-mono font-extrabold text-xs">{slotTime}</span>
                                <span
                                  className={`h-2 w-2 rounded-full ${isAvail ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                />
                              </div>
                              <span className="text-[10px] block truncate font-medium">
                                {isAvail ? 'Available' : 'Booked'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <Card className="border border-[#dce6e0] shadow-soft rounded-3xl bg-white overflow-hidden">
          <CardHeader className="p-5 border-b border-[#e9f1ed] bg-white">
            <h3 className="text-sm font-extrabold text-slate-900">
              Scheduled Appointments for {new Date(selectedDate).toLocaleDateString()}
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            {isApptsLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                No appointments found for the selected criteria.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#e9f1ed] bg-[#f8faf8] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <TableHead className="py-3 px-4">Appt #</TableHead>
                    <TableHead className="py-3 px-4">Time Slot</TableHead>
                    <TableHead className="py-3 px-4">Patient / MRN</TableHead>
                    <TableHead className="py-3 px-4">Modality &amp; Suite</TableHead>
                    <TableHead className="py-3 px-4">Examination</TableHead>
                    <TableHead className="py-3 px-4">Queue Token</TableHead>
                    <TableHead className="py-3 px-4">Priority</TableHead>
                    <TableHead className="py-3 px-4">Status</TableHead>
                    <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt: Appointment) => (
                    <TableRow key={apt.id} className="hover:bg-[#f8faf8] transition border-b border-[#f0f4f1]">
                      <TableCell className="py-3 px-4 font-mono text-xs font-bold text-slate-900">
                        {apt.appointmentNumber}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs font-mono font-medium text-slate-700">
                        {new Date(apt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(apt.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {apt.patient ? (
                          <Link
                            to={`/patients/${apt.patient.patientId}`}
                            className="font-bold text-slate-900 text-xs hover:text-emerald-700 block"
                          >
                            {apt.patient.lastName}, {apt.patient.firstName}
                          </Link>
                        ) : (
                          <span className="font-bold text-slate-900 text-xs">Unknown Patient</span>
                        )}
                        <div className="mt-0.5">
                          <IdentifierPill type="patient" value={apt.patient?.patientId || ''} />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs">
                        <Badge variant="outline" className="mr-1.5 font-mono text-[10px] rounded-full border-slate-200">
                          {apt.modality}
                        </Badge>
                        <span className="text-slate-700 font-medium">{apt.equipment?.name || apt.location || 'Suite'}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs font-medium text-slate-800">
                        {apt.examination}
                      </TableCell>
                      <TableCell className="py-3 px-4 whitespace-nowrap">
                        {apt.tokenNumber ? (
                          <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full tracking-wider shadow-soft">
                            {apt.tokenNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <PriorityBadge priority={apt.priority} />
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {apt.status === 'SCHEDULED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-3 border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-full font-bold"
                                onClick={() => setCheckInAppt(apt)}
                              >
                                Check In
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-3 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] rounded-full font-bold"
                                onClick={() => setRescheduleAppt(apt)}
                              >
                                Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-3 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] gap-1 rounded-full font-bold"
                                onClick={() => setAllocateAppt(apt)}
                                title="Assign Staff & Machine"
                              >
                                <Users className="w-3 h-3 text-emerald-600" />
                                <span>Staff</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-3 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-full font-bold"
                                onClick={() => setCancelModalData({ appt: apt, type: 'CANCEL' })}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 w-7 p-0 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            onClick={() => setLabelAppt(apt)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Staff Allocation Modal */}
      {allocateAppt && (
        <StaffAllocationModal
          open={!!allocateAppt}
          onOpenChange={(op) => !op && setAllocateAppt(null)}
          appointment={allocateAppt}
          equipmentList={equipmentList}
        />
      )}

      {/* Booking Modal */}
      <BookAppointmentModal
        open={bookModalOpen}
        onOpenChange={setBookModalOpen}
        initialDate={selectedSlotForBooking?.date || selectedDate}
        initialTime={selectedSlotForBooking?.time || '09:00'}
        initialEquipmentId={selectedSlotForBooking?.equipmentId || selectedEquipmentId}
      />

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <RescheduleAppointmentModal
          open={!!rescheduleAppt}
          onOpenChange={(op) => !op && setRescheduleAppt(null)}
          appointment={rescheduleAppt}
        />
      )}

      {/* Cancel or No-Show Modal */}
      {cancelModalData && (
        <CancelAppointmentModal
          open={!!cancelModalData}
          onOpenChange={(op) => !op && setCancelModalData(null)}
          appointment={cancelModalData.appt}
          actionType={cancelModalData.type}
        />
      )}

      {/* Reception Check-In Modal */}
      {checkInAppt && (
        <ReceptionCheckInModal
          open={!!checkInAppt}
          onOpenChange={(op) => !op && setCheckInAppt(null)}
          appointment={checkInAppt}
        />
      )}

      {/* Patient Wristband Modal */}
      {labelAppt && labelAppt.patient && (
        <PatientLabelModal
          open={!!labelAppt}
          onOpenChange={(op) => !op && setLabelAppt(null)}
          patient={{
            patientId: labelAppt.patient.patientId,
            firstName: labelAppt.patient.firstName,
            lastName: labelAppt.patient.lastName,
            dateOfBirth: labelAppt.patient.dateOfBirth,
            gender: labelAppt.patient.gender,
          }}
          accessionNumber={labelAppt.imagingOrder?.accessionNumber}
          tokenNumber={labelAppt.tokenNumber}
          modality={labelAppt.modality}
          examination={labelAppt.examination}
        />
      )}
    </div>
  );
}
