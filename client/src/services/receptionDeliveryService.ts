import { apiClient } from '../lib/api';
import {
  ReceptionReadyReport,
  ReportDeliveryRecord,
  ReportNotificationRecord,
  ReportReprintRecord,
  TatDashboardData,
} from '../types';

export const receptionDeliveryService = {
  /**
   * Fetches all finalized reports marked as ready for front-desk collection.
   */
  async getReceptionReadyReports(): Promise<ReceptionReadyReport[]> {
    const response = await apiClient<ReceptionReadyReport[]>('/reception/reports/ready');
    return response.data;
  },

  /**
   * Marks a finalized and locked report as ready for reception front-desk collection.
   */
  async sendReportToReception(orderId: string): Promise<any> {
    const response = await apiClient<any>(
      `/radiologist/worklist/${orderId}/report/send-to-reception`,
      { method: 'POST' }
    );
    return response.data;
  },

  /**
   * Records a physical handover delivery acknowledgment.
   */
  async recordDeliveryAcknowledgment(
    orderId: string,
    data: {
      deliveryMethod: string;
      recipientName: string;
      recipientRole?: string;
      notes?: string;
    }
  ): Promise<ReportDeliveryRecord> {
    const response = await apiClient<ReportDeliveryRecord>(
      `/reception/reports/${orderId}/handover`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data;
  },

  /**
   * Sends a safe patient notification via SMS or Email (local adapter).
   */
  async sendPatientNotification(
    orderId: string,
    data: {
      channel: 'SMS' | 'EMAIL';
      destinationOverride?: string;
    }
  ): Promise<ReportNotificationRecord> {
    const response = await apiClient<ReportNotificationRecord>(
      `/reception/reports/${orderId}/notify`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data;
  },

  /**
   * Records a report reprint event.
   */
  async recordReportReprint(
    orderId: string,
    data?: { reason?: string; copiesCount?: number }
  ): Promise<ReportReprintRecord> {
    const response = await apiClient<ReportReprintRecord>(
      `/reception/reports/${orderId}/reprint`,
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }
    );
    return response.data;
  },

  /**
   * Downloads report PDF directly from reception endpoint (logging reprint).
   */
  async downloadReprintPdf(orderId: string, filename = 'report.pdf', reason = 'Front Desk Printout'): Promise<void> {
    const token = localStorage.getItem('ris_auth_token') || localStorage.getItem('token') || '';
    const res = await fetch(`/api/v1/reception/reports/${orderId}/print-pdf?reason=${encodeURIComponent(reason)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(err.message || `Download failed with HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Fetches full delivery, notification, and reprint history for an order.
   */
  async getReportDeliveryHistory(orderId: string): Promise<any> {
    const response = await apiClient<any>(`/reception/reports/${orderId}/deliveries`);
    return response.data;
  },

  /**
   * Fetches Turnaround Time (TAT) dashboard metrics.
   */
  async getTatMetrics(): Promise<TatDashboardData> {
    const response = await apiClient<TatDashboardData>('/reports/tat');
    return response.data;
  },

  /**
   * Authenticates a patient for portal access.
   */
  async patientLogin(patientId: string, dateOfBirth: string): Promise<{ token: string; patient: any }> {
    const response = await apiClient<{ token: string; patient: any }>(
      '/portal/patient/login',
      {
        method: 'POST',
        body: JSON.stringify({ patientId, dateOfBirth }),
      }
    );
    return response.data;
  },

  /**
   * Fetches reports for an authenticated patient.
   */
  async getPatientReports(patientToken: string): Promise<any[]> {
    const res = await fetch('/api/v1/portal/patient/reports', {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    if (!res.ok) throw new Error('Failed to load patient reports');
    const json = await res.json();
    return json.data;
  },

  /**
   * Downloads finalized report PDF via patient portal.
   */
  async downloadPatientReportPdf(accessionNumber: string, patientToken: string): Promise<void> {
    const res = await fetch(`/api/v1/portal/patient/reports/${accessionNumber}/pdf`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(err.message || 'Download failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${accessionNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Authenticates a referring physician.
   */
  async referringDoctorLogin(email: string, registrationNumber?: string): Promise<{ token: string; doctor: any }> {
    const response = await apiClient<{ token: string; doctor: any }>(
      '/portal/referring-doctor/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, registrationNumber }),
      }
    );
    return response.data;
  },

  /**
   * Fetches reports for an authenticated referring doctor.
   */
  async getReferringDoctorReports(doctorToken: string): Promise<any[]> {
    const res = await fetch('/api/v1/portal/referring-doctor/reports', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    if (!res.ok) throw new Error('Failed to load doctor reports');
    const json = await res.json();
    return json.data;
  },

  /**
   * Downloads report PDF via referring doctor portal.
   */
  async downloadReferringDoctorReportPdf(accessionNumber: string, doctorToken: string): Promise<void> {
    const res = await fetch(`/api/v1/portal/referring-doctor/reports/${accessionNumber}/pdf`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(err.message || 'Download failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${accessionNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * 03.4 Register urgent or walk-in scan order with immediate token.
   */
  async registerWalkIn(data: any): Promise<any> {
    const res = await apiClient<any>('/reception/walk-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  /**
   * 03.9 Record signed consent form for an order.
   */
  async recordOrderConsent(orderId: string, data: any): Promise<any> {
    const res = await apiClient<any>(`/reception/orders/${orderId}/consent`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  /**
   * 03.9 View consent forms attached to order.
   */
  async getOrderConsent(orderId: string): Promise<any> {
    const res = await apiClient<any>(`/reception/orders/${orderId}/consent`);
    return res.data;
  },

  /**
   * 03.11 Retrieve printable appointment slip and preparation instructions.
   */
  async getAppointmentSlip(appointmentId: string): Promise<any> {
    const res = await apiClient<any>(`/reception/appointments/${appointmentId}/slip`);
    return res.data;
  },

  /**
   * 03.12 Get billing and payment status (due, paid, refund, part-payment).
   */
  async getOrderBilling(orderId: string): Promise<any> {
    const res = await apiClient<any>(`/reception/orders/${orderId}/billing`);
    return res.data;
  },

  /**
   * 03.12 Record patient payment with receipt generation.
   */
  async recordOrderPayment(orderId: string, data: any): Promise<any> {
    const res = await apiClient<any>(`/reception/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
};
