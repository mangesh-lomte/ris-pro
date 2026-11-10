import { apiClient } from '../lib/api';

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  phone: string;
  isExistingPatient: boolean;
  demoOtp: string;
}

export interface OtpVerifyResponse {
  token: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
  };
}

export interface AvailableExamination {
  id: string;
  code: string;
  name: string;
  modality: 'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND' | 'MAMMOGRAPHY';
  bodyPart: string;
  defaultDurationMinutes: number;
  estimatedFee: number;
  advanceDepositRequired: number;
  preparation: {
    fastingRequired: boolean;
    contrastSupported: boolean;
    contrastPreparationRequired: boolean;
    instructions: string;
  };
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  displayTime: string;
  equipmentId: string;
  equipmentName: string;
  isAvailable: boolean;
}

export interface SlotsResponse {
  date: string;
  modality: string;
  availableSlotsCount: number;
  totalSlotsCount: number;
  slots: TimeSlot[];
}

export interface PortalAppointmentSummary {
  id: string;
  appointmentNumber: string;
  examination: string;
  modality: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  status: string;
  priority: string;
  equipmentName: string;
  accessionNumber?: string;
  orderStatus?: string;
  isReportFinalized: boolean;
  studyInstanceUid?: string | null;
  hasImages?: boolean;
  prescription?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    hasStoredFile: boolean;
    doctorName?: string;
    referralNotes?: string;
    uploadedAt: string;
  } | null;
  invoice?: {
    total: number;
    paidAmount: number;
    outstandingAmount: number;
    status: string;
  } | null;
  notesData?: Record<string, unknown>;
}

export const patientPortalBookingService = {
  // 1. Request OTP
  async requestOtp(phone: string): Promise<OtpRequestResponse> {
    const res = await apiClient<OtpRequestResponse>('/portal/patient/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return res.data;
  },

  // 2. Verify OTP & authenticate
  async verifyOtp(params: {
    phone: string;
    otp: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
  }): Promise<OtpVerifyResponse> {
    const res = await apiClient<OtpVerifyResponse>('/portal/patient/verify-otp', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  },

  // 3. Get active examinations
  async getExaminations(modality?: string): Promise<AvailableExamination[]> {
    const query = modality ? `?modality=${encodeURIComponent(modality)}` : '';
    const res = await apiClient<AvailableExamination[]>(`/portal/patient/examinations${query}`);
    return res.data;
  },

  // 4. Get available slots
  async getSlots(modality: string, date: string): Promise<SlotsResponse> {
    const query = `?modality=${encodeURIComponent(modality)}&date=${encodeURIComponent(date)}`;
    const res = await apiClient<SlotsResponse>(`/portal/patient/slots${query}`);
    return res.data;
  },

  // 5. Book appointment
  async bookAppointment(
    token: string,
    payload: {
      examDefinitionId: string;
      scheduledStart: string;
      equipmentId?: string;
      clinicalNotes?: string;
    }
  ): Promise<any> {
    const res = await apiClient<any>('/portal/patient/book', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  // 6. Upload doctor prescription / referral
  async uploadReferral(
    token: string,
    appointmentId: string,
    payload: {
      fileName: string;
      fileType: string;
      referralNotes?: string;
      doctorName?: string;
      fileBase64?: string;
      fileSize?: number;
    }
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/referral`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  // 6b. Download referral file
  async downloadReferralFile(token: string, appointmentId: string): Promise<Blob> {
    const res = await fetch(`/api/v1/portal/patient/appointments/${appointmentId}/referral-file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to download prescription document');
    }
    return await res.blob();
  },

  // 7. Get preparation instructions
  async getInstructions(token: string, appointmentId: string): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/instructions`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
  },

  // 8. Submit safety questionnaire
  async submitQuestionnaire(
    token: string,
    appointmentId: string,
    payload: {
      hasMetalImplants: boolean;
      hasAllergies: boolean;
      isPregnant: boolean;
      hasKidneyDisease: boolean;
      notes?: string;
    }
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/questionnaire`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  // 9. Pay advance deposit
  async payAdvanceDeposit(
    token: string,
    appointmentId: string,
    payload: {
      amount: number;
      paymentMethod: string;
    }
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/deposit`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  // 10. Reschedule appointment
  async rescheduleAppointment(
    token: string,
    appointmentId: string,
    newStart: string,
    reason?: string
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/reschedule`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newStart, reason }),
      }
    );
    return res.data;
  },

  // 11. Cancel appointment
  async cancelAppointment(
    token: string,
    appointmentId: string,
    reason: string
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  // 12. Trigger automated reminder
  async sendReminder(
    token: string,
    appointmentId: string,
    reminderType: '24HR' | '2HR'
  ): Promise<any> {
    const res = await apiClient<any>(
      `/portal/patient/appointments/${appointmentId}/remind`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reminderType }),
      }
    );
    return res.data;
  },

  // 13. List patient appointments
  async getPatientAppointments(token: string): Promise<PortalAppointmentSummary[]> {
    const res = await apiClient<PortalAppointmentSummary[]>('/portal/patient/appointments', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // 14. Get authorized OHIF imaging viewer launch URL
  async getViewerLaunch(token: string, accessionNumber: string): Promise<{ viewerUrl: string; studyInstanceUid: string; accessionNumber: string }> {
    const res = await apiClient<{ viewerUrl: string; studyInstanceUid: string; accessionNumber: string }>(
      `/portal/patient/reports/${encodeURIComponent(accessionNumber)}/viewer`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
  },

  // 15. Download finalized diagnostic report PDF
  async downloadReportPdf(token: string, accessionNumber: string): Promise<Blob> {
    const res = await fetch(`/api/v1/portal/patient/reports/${encodeURIComponent(accessionNumber)}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to download report PDF');
    }
    return await res.blob();
  },
};
