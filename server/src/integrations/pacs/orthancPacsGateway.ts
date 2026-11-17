import {
  PacsCapabilities,
  PacsGateway,
  PacsHandoffContext,
  PacsHandoffResult,
  PacsHealthResult,
  PacsStudyLookupOutcome,
  OrthancStudyMetadata,
  DicomSeriesSummary,
} from './pacsGateway.interface';
import { AppError } from '../../utils/appError';

export interface OrthancGatewayOptions {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

export class OrthancPacsGateway implements PacsGateway {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly timeoutMs: number;

  constructor(options: OrthancGatewayOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.username = options.username;
    this.password = options.password;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Centralized HTTP client for backend-to-Orthanc REST calls with Basic Auth and timeouts.
   * Credentials and auth headers are strictly prevented from appearing in errors or logs.
   */
  private async fetchOrthanc<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    const authHeader = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw AppError.unauthorized(
          'Orthanc PACS authentication failed. Please verify configured credentials.',
          'PACS_AUTHENTICATION_FAILED'
        );
      }

      if (!response.ok) {
        throw AppError.internal(
          `Orthanc PACS request failed with HTTP ${response.status}`,
          'PACS_UNAVAILABLE'
        );
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw AppError.internal(
          'Invalid JSON response received from Orthanc PACS.',
          'PACS_RESPONSE_INVALID'
        );
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === 'AbortError') {
        throw AppError.internal(
          `Orthanc PACS request timed out after ${this.timeoutMs}ms.`,
          'PACS_TIMEOUT'
        );
      }
      // Network failure, connection refused, or unreachable host
      throw AppError.internal(
        'Orthanc PACS server is unavailable or connection was refused.',
        'PACS_UNAVAILABLE'
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async checkHealth(): Promise<PacsHealthResult> {
    const now = new Date();
    try {
      const system = await this.fetchOrthanc<any>('/system');
      let dicomWebPluginAvailable = false;
      try {
        const plugins = await this.fetchOrthanc<string[]>('/plugins');
        dicomWebPluginAvailable = Array.isArray(plugins) && plugins.includes('dicom-web');
      } catch {
        // Plugin check failure is non-fatal for general health
      }

      return {
        connected: true,
        serverName: system.Name || 'RadAxis RIS PACS',
        version: system.Version || 'Unknown',
        apiVersion: system.ApiVersion,
        dicomAet: system.DicomAet || 'RADAXIS',
        dicomWebPluginAvailable,
        checkedAt: now,
      };
    } catch (error: any) {
      return {
        connected: false,
        serverName: 'RadAxis RIS PACS',
        details: error.message || 'Orthanc server unreachable',
        checkedAt: now,
      };
    }
  }

  async getCapabilities(): Promise<PacsCapabilities> {
    const health = await this.checkHealth();
    return {
      adapter: 'orthanc',
      connected: health.connected,
      serverName: health.serverName || 'RadAxis RIS PACS',
      version: health.version,
      dicomWebPluginAvailable: health.dicomWebPluginAvailable ?? false,
      metadataLookupSupported: true,
      reconciliationSupported: true,
      dicomTransferSupported: false, // Honesty boundary: RIS does not yet transmit DICOM files
      viewerSupported: false,
    };
  }

  async findStudyByAccession(accessionNumber: string): Promise<{
    outcome: PacsStudyLookupOutcome;
    studies: OrthancStudyMetadata[];
    rawError?: string;
  }> {
    try {
      const results = await this.fetchOrthanc<any[]>('/tools/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Level: 'Studies',
          Expand: true,
          Query: {
            AccessionNumber: accessionNumber,
          },
          RequestedTags: [
            'PatientID',
            'PatientName',
            'AccessionNumber',
            'StudyDescription',
            'StudyDate',
            'StudyInstanceUID',
            'ModalitiesInStudy',
          ],
        }),
      });

      if (!Array.isArray(results) || results.length === 0) {
        return {
          outcome: PacsStudyLookupOutcome.NOT_FOUND,
          studies: [],
        };
      }

      const studies: OrthancStudyMetadata[] = results.map((item) => {
        const requested = item.RequestedTags || {};
        const main = item.MainDicomTags || {};
        const patientMain = item.PatientMainDicomTags || {};

        let modalities: string[] = [];
        const rawModalities = requested.ModalitiesInStudy || main.ModalitiesInStudy;
        if (Array.isArray(rawModalities)) {
          modalities = rawModalities;
        } else if (typeof rawModalities === 'string') {
          modalities = rawModalities.split('\\').map((s) => s.trim()).filter(Boolean);
        }

        return {
          orthancStudyId: item.ID,
          accessionNumber: String(requested.AccessionNumber || main.AccessionNumber || '').trim(),
          patientId: requested.PatientID || patientMain.PatientID || null,
          patientName: requested.PatientName || patientMain.PatientName || null,
          studyInstanceUid: requested.StudyInstanceUID || main.StudyInstanceUID || null,
          studyDate: requested.StudyDate || main.StudyDate || null,
          studyDescription: requested.StudyDescription || main.StudyDescription || null,
          modalitiesInStudy: modalities,
        };
      });

      if (studies.length > 1) {
        return {
          outcome: PacsStudyLookupOutcome.AMBIGUOUS_MATCH,
          studies,
        };
      }

      return {
        outcome: PacsStudyLookupOutcome.MATCHED,
        studies,
      };
    } catch (error: any) {
      if (
        error?.code === 'PACS_TIMEOUT' ||
        error?.code === 'PACS_UNAVAILABLE' ||
        error?.code === 'PACS_AUTHENTICATION_FAILED'
      ) {
        return {
          outcome: PacsStudyLookupOutcome.PACS_UNAVAILABLE,
          studies: [],
          rawError: error.message,
        };
      }
      throw error;
    }
  }

  async findStudyByStudyInstanceUid(studyInstanceUid: string): Promise<OrthancStudyMetadata | null> {
    if (!studyInstanceUid || studyInstanceUid.trim().length === 0) {
      return null;
    }

    try {
      const results = await this.fetchOrthanc<any[]>('/tools/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Level: 'Studies',
          Expand: true,
          Query: {
            StudyInstanceUID: studyInstanceUid.trim(),
          },
          RequestedTags: [
            'PatientID',
            'PatientName',
            'AccessionNumber',
            'StudyDescription',
            'StudyDate',
            'StudyInstanceUID',
            'ModalitiesInStudy',
          ],
        }),
      });

      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }

      const item = results[0];
      const requested = item.RequestedTags || {};
      const main = item.MainDicomTags || {};
      const patientMain = item.PatientMainDicomTags || {};

      let modalities: string[] = [];
      const rawModalities = requested.ModalitiesInStudy || main.ModalitiesInStudy;
      if (Array.isArray(rawModalities)) {
        modalities = rawModalities;
      } else if (typeof rawModalities === 'string') {
        modalities = rawModalities.split('\\').map((s) => s.trim()).filter(Boolean);
      }

      return {
        orthancStudyId: item.ID,
        accessionNumber: String(requested.AccessionNumber || main.AccessionNumber || '').trim(),
        patientId: requested.PatientID || patientMain.PatientID || null,
        patientName: requested.PatientName || patientMain.PatientName || null,
        studyInstanceUid: requested.StudyInstanceUID || main.StudyInstanceUID || null,
        studyDate: requested.StudyDate || main.StudyDate || null,
        studyDescription: requested.StudyDescription || main.StudyDescription || null,
        modalitiesInStudy: modalities,
      };
    } catch {
      return null;
    }
  }

  async getStudyMetadata(orthancStudyId: string): Promise<OrthancStudyMetadata | null> {
    try {
      const item = await this.fetchOrthanc<any>(`/studies/${orthancStudyId}`);
      if (!item || !item.ID) {
        return null;
      }
      const main = item.MainDicomTags || {};
      const patientMain = item.PatientMainDicomTags || {};

      let modalities: string[] = [];
      if (typeof main.ModalitiesInStudy === 'string') {
        modalities = main.ModalitiesInStudy.split('\\').map((s: string) => s.trim()).filter(Boolean);
      }

      return {
        orthancStudyId: item.ID,
        accessionNumber: String(main.AccessionNumber || '').trim(),
        patientId: patientMain.PatientID || null,
        patientName: patientMain.PatientName || null,
        studyInstanceUid: main.StudyInstanceUID || null,
        studyDate: main.StudyDate || null,
        studyDescription: main.StudyDescription || null,
        modalitiesInStudy: modalities,
      };
    } catch {
      return null;
    }
  }

  async requestHandoff(_context: PacsHandoffContext): Promise<PacsHandoffResult> {
    // Honest boundary: Orthanc is real, but RIS has no DICOM payload to transmit in Phase 3.6R
    throw AppError.conflict(
      'Real Orthanc connectivity is available, but this RIS does not yet have a DICOM payload to transmit.',
      'PACS_TRANSFER_NOT_AVAILABLE'
    );
  }

  async getStudySeriesAndInstances(orthancStudyId: string): Promise<DicomSeriesSummary[]> {
    try {
      const seriesList = await this.fetchOrthanc<any[]>(`/studies/${orthancStudyId}/series`);
      const instancesList = await this.fetchOrthanc<any[]>(`/studies/${orthancStudyId}/instances`);

      const seriesMap = new Map<string, DicomSeriesSummary>();

      for (const s of seriesList) {
        const main = s.MainDicomTags || {};
        seriesMap.set(s.ID, {
          seriesInstanceUid: main.SeriesInstanceUID || s.ID,
          seriesNumber: main.SeriesNumber ? parseInt(main.SeriesNumber, 10) : undefined,
          modality: main.Modality,
          seriesDescription: main.SeriesDescription,
          numberOfInstances: Array.isArray(s.Instances) ? s.Instances.length : 0,
          instances: [],
        });
      }

      for (const inst of instancesList) {
        const parentSeriesId = inst.ParentSeries;
        const targetSeries = seriesMap.get(parentSeriesId);
        if (targetSeries) {
          const main = inst.MainDicomTags || {};
          let sliceLoc: number | undefined = undefined;
          if (main.SliceLocation !== undefined) {
            const parsed = parseFloat(main.SliceLocation);
            if (!isNaN(parsed)) sliceLoc = parsed;
          } else if (main.ImagePositionPatient) {
            const parts = String(main.ImagePositionPatient).split('\\');
            if (parts.length >= 3) {
              const z = parseFloat(parts[2]);
              if (!isNaN(z)) sliceLoc = z;
            }
          }

          const instanceNum = main.InstanceNumber ? parseInt(main.InstanceNumber, 10) : undefined;
          targetSeries.instances.push({
            sopInstanceUid: main.SOPInstanceUID || inst.ID,
            instanceNumber: instanceNum,
            sliceLocation: sliceLoc,
          });
        }
      }

      const result = Array.from(seriesMap.values());
      result.forEach((ser) => {
        ser.instances.sort((a, b) => (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0));
      });
      result.sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0));
      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to retrieve DICOM series and instances from Orthanc: ${error.message || 'unknown error'}`,
        'ORTHANC_INSTANCE_QUERY_FAILED'
      );
    }
  }

  /**
   * Retrieves the complete authentic DICOM ZIP archive from Orthanc for a specific study.
   * Returns a binary Buffer or null if not found.
   */
  async getStudyArchive(orthancStudyId: string): Promise<Buffer | null> {
    const cleanEndpoint = `/studies/${orthancStudyId}/archive`;
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 60000); // 60s timeout for archive downloads

    const authHeader = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: 'application/zip, application/octet-stream',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        throw AppError.unauthorized(
          'Orthanc PACS authentication failed. Please verify configured credentials.',
          'PACS_AUTHENTICATION_FAILED'
        );
      }

      if (!response.ok) {
        throw AppError.internal(
          `Orthanc PACS request failed with HTTP ${response.status}`,
          'PACS_UNAVAILABLE'
        );
      }

      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error.name === 'AbortError') {
        throw AppError.internal('Orthanc PACS archive request timed out.', 'PACS_TIMEOUT');
      }
      throw AppError.internal(
        'Orthanc PACS server is unavailable or connection was refused.',
        'PACS_UNAVAILABLE'
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

