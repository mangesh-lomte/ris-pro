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

export function ReceptionQueuePage() {
  const todayStr = new Date().toISOString().split('T')[0];
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
    queryKey: ['scheduledToday', selectedModality],
    queryFn: () =>
      fetchAppointments({
        date: todayStr,
        status: 'SCHEDULED' as any,
        modality: selectedModality,
        pageSize: 50,
      }),
  });

  const queue: Appointment[] = Array.isArray(queueData) ? queueData : [];
  const pendingArrivals: Appointment[] = scheduledData?.data?.items || [];

  const counts = {
    totalScheduled: (scheduledData?.data?.total || pendingArrivals.length) + queue.length,
    waiting: queue.length,
    inProgress: 1,
    completed: 4,
    cancelledOrNoShow: 1,
  };

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE2EC]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">
            Reception Desk & Patient Waiting Queue
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Daily sequence tokens, identity safety check-in, and prioritized technologist dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowWalkInModal(true)}
            className="text-xs gap-1.5 shadow-xs rounded-lg"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Walk-In Scan Order</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchQueue()}
            className="text-xs gap-1.5 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#33398A]" />
            <span>Refresh Queue</span>
          </Button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div role="tablist" aria-label="Reception Desk Views" className="flex items-center gap-2 border-b border-[#DCE2EC] pb-2 overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          onClick={() => setActiveTab('queue')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] shrink-0 cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-[#33398A] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F3F6FC] hover:text-[#15233B]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Patient Waiting Queue</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'delivery'}
          onClick={() => setActiveTab('delivery')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] shrink-0 cursor-pointer ${
            activeTab === 'delivery'
              ? 'bg-[#33398A] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F3F6FC] hover:text-[#15233B]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Report Delivery & Front Desk Handover</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tat'}
          onClick={() => setActiveTab('tat')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] shrink-0 cursor-pointer ${
            activeTab === 'tat'
              ? 'bg-[#33398A] text-white shadow-xs'
              : 'text-[#64748B] hover:bg-[#F3F6FC] hover:text-[#15233B]'
          }`}
        >
          <Clock className="w-4 h-4" />
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
            <Card className="border-slate-200/90 p-3.5 bg-white shadow-sm rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Today's Total</span>
                <CalendarCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{counts.totalScheduled}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Scheduled for today</p>
            </Card>

            <Card className="border-[#174A70]/30 p-3.5 bg-[#174A70]/5 shadow-sm rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#174A70] uppercase">Waiting in Queue</span>
                <Users className="w-4 h-4 text-[#174A70]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{counts.waiting}</div>
              <p className="text-[10px] text-[#174A70] mt-0.5 font-medium">Checked-in & Ready for Tech</p>
            </Card>

            <Card className="border-indigo-200 p-3.5 bg-indigo-50/40 shadow-sm rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-900 uppercase">With Scanner</span>
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-bold text-indigo-700 mt-1 tabular-nums">{counts.inProgress}</div>
              <p className="text-[10px] text-indigo-700 mt-0.5">Acquisition in progress</p>
            </Card>

            <Card className="border-emerald-200 p-3.5 bg-emerald-50/40 shadow-sm rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-900 uppercase">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{counts.completed}</div>
              <p className="text-[10px] text-emerald-700 mt-0.5">Scans finished</p>
            </Card>

            <Card className="border-slate-200/90 p-3.5 bg-white shadow-sm rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">No-Show / Cancel</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{counts.cancelledOrNoShow}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Unfulfilled slots</p>
            </Card>
          </div>

          {/* Modality Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Filter Modality:</span>
            <button
              type="button"
              onClick={() => setSelectedModality(undefined)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
                selectedModality === undefined ? 'bg-[#174A70] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Modalities
            </button>
            {(['MRI', 'CT', 'XRAY'] as ModalityType[]).map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setSelectedModality(selectedModality === mod ? undefined : mod)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  selectedModality === mod ? 'bg-[#174A70] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>

      {/* Active Waiting Queue */}
      <Card className="border-cyan-300 shadow-sm overflow-hidden">
        <CardHeader className="bg-cyan-50/70 pb-3 border-b border-cyan-200 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-cyan-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Waiting Room Queue ({queue.length} Patients)
              </h3>
              <p className="text-[11px] text-slate-500">
                Sorted by clinical urgency (STAT &gt; URGENT &gt; ROUTINE) then check-in time
              </p>
            </div>
          </div>
          <Badge variant="cyan" className="font-mono text-xs font-bold">
            Live Telemetry
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {isQueueLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            </div>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Waiting Room Clear</p>
              <p className="text-[11px] text-slate-500 mt-0.5">All checked-in patients have been dispatched to scanner suites.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue Token</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Patient / MRN</TableHead>
                  <TableHead>Examination & Suite</TableHead>
                  <TableHead>Accession #</TableHead>
                  <TableHead>Arrival / Wait Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item: Appointment) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/70 transition">
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#174A70] bg-[#174A70]/10 border border-[#174A70]/25 px-2.5 py-1 rounded-md tracking-wider shadow-2xs">
                          {item.tokenNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={item.priority} />
                    </TableCell>
                    <TableCell>
                      {item.patient ? (
                        <Link
                          to={`/patients/${item.patient.patientId}`}
                          className="font-bold text-slate-900 text-xs hover:text-cyan-700 hover:underline block"
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
                    <TableCell>
                      <div className="text-xs font-medium text-slate-900">
                        {item.examination}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.equipment?.name || item.location || 'Suite'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.imagingOrder?.accessionNumber ? (
                        <IdentifierPill type="accession" value={item.imagingOrder.accessionNumber} />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {item.checkedInAt ? (
                        <div>
                          <span className="text-slate-900 font-semibold block">
                            {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {Math.max(0, Math.floor((Date.now() - new Date(item.checkedInAt).getTime()) / 60000))} mins waiting
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.imagingOrder?.orderStatus || item.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
                          onClick={() => setSlipApptId(item.id)}
                          title="Print Appointment Slip & Prep Instructions"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Slip</span>
                        </Button>
                        {item.imagingOrderId && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
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
                              className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
                              onClick={() =>
                                setBillingOrder({
                                  id: item.imagingOrderId!,
                                  accession: item.imagingOrder?.accessionNumber || 'N/A',
                                  patientName: `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`,
                                })
                              }
                              title="View Payment Status & Collect Billing"
                            >
                              <CreditCard className="w-3 h-3 text-indigo-600" />
                              <span>Billing</span>
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
                          onClick={() => setLabelAppt(item)}
                        >
                          <Printer className="w-3 h-3" />
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
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pending Arrivals Today ({pendingArrivals.length} Appointments)
              </h3>
              <p className="text-xs text-slate-500">
                Scheduled patients awaiting reception desk arrival and identity verification
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isScheduledLoading ? (
            <div className="flex h-36 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            </div>
          ) : pendingArrivals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-2 border border-slate-200">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800">No Pending Arrivals</p>
              <p className="text-[11px] text-slate-500 mt-0.5">All scheduled appointments for today have arrived or have been checked in.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appt #</TableHead>
                  <TableHead>Scheduled Time</TableHead>
                  <TableHead>Patient / MRN</TableHead>
                  <TableHead>Modality & Suite</TableHead>
                  <TableHead>Examination</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Reception Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingArrivals.map((apt) => (
                  <TableRow key={apt.id} className="hover:bg-slate-50/70 transition">
                    <TableCell className="font-mono text-xs font-semibold">
                      {apt.appointmentNumber}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-slate-900">
                      {new Date(apt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {new Date(apt.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      {apt.patient ? (
                        <Link
                          to={`/patients/${apt.patient.patientId}`}
                          className="font-semibold text-slate-900 text-xs hover:text-cyan-700 hover:underline block"
                        >
                          {apt.patient.lastName}, {apt.patient.firstName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-900 text-xs">Unknown Patient</span>
                      )}
                      <div className="mt-0.5">
                        <IdentifierPill type="patient" value={apt.patient?.patientId || ''} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="mr-1.5 font-mono text-[10px]">
                        {apt.modality}
                      </Badge>
                      <span className="text-slate-700">{apt.equipment?.name || apt.location || 'Suite'}</span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">
                      {apt.examination}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={apt.priority} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-[#174A70] hover:bg-[#123855] text-white gap-1"
                          onClick={() => setCheckInAppt(apt)}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Check In</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 border-slate-300 hover:bg-slate-100"
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
