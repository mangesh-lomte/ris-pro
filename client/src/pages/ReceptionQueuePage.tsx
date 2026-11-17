import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchReceptionQueue, fetchAppointments } from '../services/appointmentService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Appointment, ModalityType } from '../types';
import {
  Users,
  Ticket,
  Clock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  CalendarCheck,
  RefreshCw,
  FileText,
  Flame,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

import { ReceptionCheckInModal } from '../features/reception/ReceptionCheckInModal';
import { CancelAppointmentModal } from '../features/scheduling/CancelAppointmentModal';
import { PatientLabelModal } from '../components/shared/PatientLabelModal';
import { ReportDeliveryView } from '../features/reception/ReportDeliveryView';
import { TatDashboardView } from '../features/reception/TatDashboardView';
import { WalkInRegistrationModal } from '../features/reception/WalkInRegistrationModal';
import { AppointmentSlipModal } from '../features/reception/AppointmentSlipModal';
import { OrderConsentModal } from '../features/reception/OrderConsentModal';
import { OrderBillingModal } from '../features/reception/OrderBillingModal';
import { toLocalDateString } from '../utils/formatters';

export function ReceptionQueuePage() {
  const todayStr = toLocalDateString();
  const [selectedModality, setSelectedModality] = useState<ModalityType | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'queue' | 'delivery' | 'tat'>('queue');

  const [checkInAppt, setCheckInAppt] = useState<Appointment | null>(null);
  const [noShowAppt, setNoShowAppt] = useState<Appointment | null>(null);
  const [labelAppt, setLabelAppt] = useState<Appointment | null>(null);

  // Module 03 Feature Modal States
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [slipApptId, setSlipApptId] = useState<string | null>(null);
  const [consentOrder, setConsentOrder] = useState<{ id: string; accession: string; patientName: string } | null>(null);
  const [billingOrder, setBillingOrder] = useState<{ id: string; accession: string; patientName: string } | null>(null);

  // Fetch Waiting Queue
  const {
    data: queueData,
    isLoading: isQueueLoading,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['receptionQueue', selectedModality],
    queryFn: () =>
      fetchReceptionQueue({
        date: todayStr,
        modality: selectedModality,
      }),
    refetchInterval: 15000, // Real-time queue polling every 15s
  });

  // Fetch Pending Scheduled Arrivals (Not yet checked in)
  const { data: scheduledData, isLoading: isScheduledLoading } = useQuery({
    queryKey: ['appointmentsToday', selectedModality],
    queryFn: () =>
      fetchAppointments({
        date: todayStr,
        modality: selectedModality,
        pageSize: 100,
      }),
  });

  const queue: Appointment[] = Array.isArray(queueData) ? queueData : [];
  const allToday: Appointment[] = scheduledData?.data?.items || [];
  const pendingArrivals = allToday.filter((appointment) => appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED');

  const counts = {
    totalScheduled: scheduledData?.data?.total || allToday.length,
    waiting: queue.filter((appointment) => appointment.movementStage === 'RECEPTION').length,
    inProgress: queue.filter((appointment) => appointment.movementStage === 'SCANNER').length,
    completed: allToday.filter((appointment) => appointment.status === 'COMPLETED' || appointment.imagingOrder?.orderStatus === 'SCAN_COMPLETED').length,
    cancelledOrNoShow: allToday.filter((appointment) => appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW').length,
  };

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Reception Desk &amp; Patient Waiting Queue
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daily sequence tokens, identity safety check-in, and prioritized technologist dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowWalkInModal(true)}
            className="text-xs font-bold gap-1.5 shadow-soft rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Walk-In Scan Order</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchQueue()}
            className="text-xs font-bold gap-1.5 rounded-full border-[#dce6e0] text-slate-800 hover:bg-[#f8faf8] px-3.5 py-1.5 shadow-soft"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Refresh Queue</span>
          </Button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div role="tablist" aria-label="Reception Desk Views" className="flex items-center gap-1.5 bg-[#f0f4f1] p-1 rounded-full w-fit overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${activeTab === 'queue'
            ? 'bg-slate-900 text-white shadow-soft font-extrabold'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Patient Waiting Queue</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'delivery'}
          onClick={() => setActiveTab('delivery')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${activeTab === 'delivery'
            ? 'bg-slate-900 text-white shadow-soft font-extrabold'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Report Delivery &amp; Front Desk Handover</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tat'}
          onClick={() => setActiveTab('tat')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${activeTab === 'tat'
            ? 'bg-slate-900 text-white shadow-soft font-extrabold'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>TAT Performance Dashboard</span>
        </button>
      </div>

      {activeTab === 'delivery' ? (
        <ReportDeliveryView />
      ) : activeTab === 'tat' ? (
        <TatDashboardView />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border border-[#dce6e0] p-4 bg-gradient-to-br from-[#f2f7ec] to-white shadow-soft rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Total</span>
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">{counts.totalScheduled}</div>
              <p className="text-[11px] text-slate-500 font-medium">Scheduled exams</p>
            </Card>

            <Card className="border border-sky-100 p-4 bg-gradient-to-br from-[#eaf4fd] to-white shadow-soft rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Waiting in Queue</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">{counts.waiting}</div>
              <p className="text-[11px] text-sky-700 font-medium">Checked-in &amp; ready</p>
            </Card>

            <Card className="border border-purple-100 p-4 bg-gradient-to-br from-[#f6effb] to-white shadow-soft rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">With Scanner</span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-purple-900 mt-1 font-mono">{counts.inProgress}</div>
              <p className="text-[11px] text-purple-700 font-medium">Acquisition active</p>
            </Card>

            <Card className="border border-emerald-100 p-4 bg-gradient-to-br from-[#e8f7f0] to-white shadow-soft rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-800 mt-1 font-mono">{counts.completed}</div>
              <p className="text-[11px] text-emerald-700 font-medium">Scans finished</p>
            </Card>

            <Card className="border border-amber-100 p-4 bg-gradient-to-br from-[#fef5e9] to-white shadow-soft rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">No-Show / Cancel</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold text-amber-900 mt-1 font-mono">{counts.cancelledOrNoShow}</div>
              <p className="text-[11px] text-amber-700 font-medium">Unfulfilled slots</p>
            </Card>
          </div>

          {/* Modality Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Filter Modality:</span>
            <div className="flex items-center gap-1 bg-[#f0f4f1] p-1 rounded-full">
              <button
                type="button"
                onClick={() => setSelectedModality(undefined)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${selectedModality === undefined ? 'bg-slate-900 text-white shadow-soft' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All Modalities
              </button>
              {(['MRI', 'CT', 'XRAY'] as ModalityType[]).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setSelectedModality(selectedModality === mod ? undefined : mod)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${selectedModality === mod ? 'bg-slate-900 text-white shadow-soft' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          {/* Active Waiting Queue */}
          <Card className="border border-[#dce6e0] shadow-soft rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-white px-5 py-4 border-b border-[#e9f1ed] flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Active Waiting Room Queue ({queue.length} Patients)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Sorted by clinical urgency (STAT &gt; URGENT &gt; ROUTINE) then check-in timestamp
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] font-bold text-emerald-900 bg-emerald-100/70 border-emerald-200 rounded-full px-2.5 py-0.5">
                Live Queue Active
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {isQueueLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-2 border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">Waiting Room Clear</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">No checked-in patients are currently active in the reception workflow.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#e9f1ed] bg-[#f8faf8] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <TableHead className="py-3 px-4">Queue Token</TableHead>
                      <TableHead className="py-3 px-4">Urgency</TableHead>
                      <TableHead className="py-3 px-4">Patient / MRN</TableHead>
                      <TableHead className="py-3 px-4">Examination &amp; Suite</TableHead>
                      <TableHead className="py-3 px-4">Accession #</TableHead>
                      <TableHead className="py-3 px-4">Arrival / Wait Time</TableHead>
                      <TableHead className="py-3 px-4">Current Location</TableHead>
                      <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item: Appointment) => (
                      <TableRow key={item.id} className="hover:bg-[#f8faf8] transition border-b border-[#f0f4f1]">
                        <TableCell className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full tracking-wider shadow-soft">
                              {item.tokenNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <PriorityBadge priority={item.priority} />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {item.patient ? (
                            <Link
                              to={`/patients/${item.patient.patientId}`}
                              className="font-bold text-slate-900 text-xs hover:text-emerald-700 block"
                            >
                              {item.patient.lastName}, {item.patient.firstName}
                            </Link>
                          ) : (
                            <span className="font-bold text-slate-900 text-xs">Unknown Patient</span>
                          )}
                          <div className="mt-0.5">
                            <IdentifierPill type="patient" value={item.patient?.patientId || ''} />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="text-xs font-bold text-slate-900">
                            {item.examination}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono font-medium">
                            {item.equipment?.name || item.location || 'Suite'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {item.imagingOrder?.accessionNumber ? (
                            <IdentifierPill type="accession" value={item.imagingOrder.accessionNumber} />
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs font-mono">
                          {item.checkedInAt ? (
                            <div>
                              <span className="text-slate-900 font-bold block">
                                {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-slate-400 text-[10px] font-medium">
                                {Math.max(0, Math.floor((Date.now() - new Date(item.checkedInAt).getTime()) / 60000))} mins waiting
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="space-y-1">
                            <StatusBadge status={item.movementStage || item.imagingOrder?.orderStatus || item.status} />
                            {item.movementUpdatedAt && <div className="text-[10px] text-slate-400 font-medium">Updated {new Date(item.movementUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-3 gap-1 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] rounded-full font-bold"
                              onClick={() => setSlipApptId(item.id)}
                              title="Print Appointment Slip & Prep Instructions"
                            >
                              <FileText className="w-3 h-3 text-slate-500" />
                              <span>Slip</span>
                            </Button>
                            {item.imagingOrderId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 px-3 gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-full font-bold"
                                  onClick={() =>
                                    setConsentOrder({
                                      id: item.imagingOrderId!,
                                      accession: item.imagingOrder?.accessionNumber || 'N/A',
                                      patientName: `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`,
                                    })
                                  }
                                  title="Collect & View Signed Consent Forms"
                                >
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Consent</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 px-3 gap-1 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] rounded-full font-bold"
                                  onClick={() =>
                                    setBillingOrder({
                                      id: item.imagingOrderId!,
                                      accession: item.imagingOrder?.accessionNumber || 'N/A',
                                      patientName: `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`,
                                    })
                                  }
                                  title="View Payment Status & Collect Billing"
                                >
                                  <CreditCard className="w-3 h-3 text-emerald-600" />
                                  <span>Billing</span>
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-3 gap-1 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] rounded-full font-bold"
                              onClick={() => setLabelAppt(item)}
                            >
                              <Printer className="w-3 h-3 text-slate-500" />
                              <span>Wristband</span>
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

          {/* Today's Expected Arrivals */}
          <Card className="border border-[#dce6e0] shadow-soft rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-white px-5 py-4 border-b border-[#e9f1ed]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Pending Arrivals Today ({pendingArrivals.length} Appointments)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Scheduled patients awaiting reception desk arrival and identity verification
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isScheduledLoading ? (
                <div className="flex h-36 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                </div>
              ) : pendingArrivals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-2 border border-emerald-100">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">No Pending Arrivals</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">All scheduled appointments for today have arrived or have been checked in.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#e9f1ed] bg-[#f8faf8] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <TableHead className="py-3 px-4">Appt #</TableHead>
                      <TableHead className="py-3 px-4">Scheduled Time</TableHead>
                      <TableHead className="py-3 px-4">Patient / MRN</TableHead>
                      <TableHead className="py-3 px-4">Modality &amp; Suite</TableHead>
                      <TableHead className="py-3 px-4">Examination</TableHead>
                      <TableHead className="py-3 px-4">Priority</TableHead>
                      <TableHead className="py-3 px-4 text-right">Reception Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingArrivals.map((apt) => (
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
                        <TableCell className="py-3 px-4">
                          <PriorityBadge priority={apt.priority} />
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              className="text-xs h-7 px-3.5 bg-slate-900 hover:bg-slate-800 text-white gap-1 rounded-full font-bold shadow-soft"
                              onClick={() => setCheckInAppt(apt)}
                            >
                              <UserCheck className="w-3 h-3 text-emerald-400" />
                              <span>Check In</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-3 gap-1 border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] rounded-full font-bold"
                              onClick={() => setSlipApptId(apt.id)}
                              title="Print Appointment Slip & Prep Instructions"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Slip</span>
                            </Button>
                            {apt.imagingOrderId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
                                onClick={() =>
                                  setBillingOrder({
                                    id: apt.imagingOrderId!,
                                    accession: apt.imagingOrder?.accessionNumber || 'N/A',
                                    patientName: `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`,
                                  })
                                }
                                title="View Payment Status & Collect Billing"
                              >
                                <CreditCard className="w-3 h-3 text-indigo-600" />
                                <span>Billing</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => setNoShowAppt(apt)}
                            >
                              No-Show
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
        </>
      )}

      {/* Walk-In Registration Modal */}
      {showWalkInModal && (
        <WalkInRegistrationModal
          open={showWalkInModal}
          onOpenChange={setShowWalkInModal}
          onSuccess={() => refetchQueue()}
        />
      )}

      {/* Appointment Slip & Preparation Instructions Modal */}
      {slipApptId && (
        <AppointmentSlipModal
          open={!!slipApptId}
          onOpenChange={(op) => !op && setSlipApptId(null)}
          appointmentId={slipApptId}
        />
      )}

      {/* Order Consent Modal */}
      {consentOrder && (
        <OrderConsentModal
          open={!!consentOrder}
          onOpenChange={(op) => !op && setConsentOrder(null)}
          orderId={consentOrder.id}
          accessionNumber={consentOrder.accession}
          patientName={consentOrder.patientName}
        />
      )}

      {/* Order Billing & Payment Modal */}
      {billingOrder && (
        <OrderBillingModal
          open={!!billingOrder}
          onOpenChange={(op) => !op && setBillingOrder(null)}
          orderId={billingOrder.id}
          accessionNumber={billingOrder.accession}
          patientName={billingOrder.patientName}
        />
      )}

      {/* Check-In Modal */}
      {checkInAppt && (
        <ReceptionCheckInModal
          open={!!checkInAppt}
          onOpenChange={(op) => !op && setCheckInAppt(null)}
          appointment={checkInAppt}
        />
      )}

      {/* No Show Modal */}
      {noShowAppt && (
        <CancelAppointmentModal
          open={!!noShowAppt}
          onOpenChange={(op) => !op && setNoShowAppt(null)}
          appointment={noShowAppt}
          actionType="NO_SHOW"
        />
      )}

      {/* Wristband Modal */}
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
