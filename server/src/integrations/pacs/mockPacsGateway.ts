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

export type MockPacsOutcome = 'success' | 'failure' | 'fail_once';

export class MockPacsGateway implements PacsGateway {
  private outcome: MockPacsOutcome;
  private failOnceAttemptCount = 0;
  private mockStudies: OrthancStudyMetadata[] = [];

  constructor(defaultOutcome: MockPacsOutcome = 'success') {
    this.outcome = defaultOutcome;
  }

  setOutcome(outcome: MockPacsOutcome): void {
    this.outcome = outcome;
    this.failOnceAttemptCount = 0;
  }

  getOutcome(): MockPacsOutcome {
    return this.outcome;
  }

  reset(): void {
    this.failOnceAttemptCount = 0;
    this.mockStudies = [];
  }

  addMockStudy(study: OrthancStudyMetadata): void {
    this.mockStudies.push(study);
  }

  setMockStudies(studies: OrthancStudyMetadata[]): void {
    this.mockStudies = [...studies];
  }

  clearMockStudies(): void {
    this.mockStudies = [];
  }

  async checkHealth(): Promise<PacsHealthResult> {
    const now = new Date();
    if (this.outcome === 'failure') {
      return {
        connected: false,
        serverName: 'Mock PACS Server (Simulated)',
        details: 'Demo PACS Adapter: Simulated downstream PACS storage service unavailable.',
        checkedAt: now,
      };
    }

    return {
      connected: true,
      serverName: 'Mock PACS Server (Simulated)',
      version: '1.0.0-mock',
      apiVersion: 1,
      dicomAet: 'MOCKPACS',
      dicomWebPluginAvailable: true,
      checkedAt: now,
    };
  }

  async getCapabilities(): Promise<PacsCapabilities> {
    const isConnected = this.outcome !== 'failure';
    return {
      adapter: 'mock',
      connected: isConnected,
      serverName: 'Mock PACS Server (Simulated)',
      version: '1.0.0-mock',
      dicomWebPluginAvailable: true,
      metadataLookupSupported: true,
      reconciliationSupported: true,
      dicomTransferSupported: true, // Simulated transfer supported in mock mode
      viewerSupported: false,
    };
  }

  async findStudyByAccession(accessionNumber: string): Promise<{
    outcome: PacsStudyLookupOutcome;
    studies: OrthancStudyMetadata[];
    rawError?: string;
  }> {
    if (this.outcome === 'failure') {
      return {
        outcome: PacsStudyLookupOutcome.PACS_UNAVAILABLE,
        studies: [],
        rawError: 'Demo PACS Adapter: Simulated downstream PACS service unavailable.',
      };
    }

    const matches = this.mockStudies.filter(
      (study) => study.accessionNumber.trim().toUpperCase() === accessionNumber.trim().toUpperCase()
    );

    if (matches.length === 0) {
      return {
        outcome: PacsStudyLookupOutcome.NOT_FOUND,
        studies: [],
      };
    }

    if (matches.length > 1) {
      return {
        outcome: PacsStudyLookupOutcome.AMBIGUOUS_MATCH,
        studies: matches,
      };
    }

    return {
      outcome: PacsStudyLookupOutcome.MATCHED,
      studies: matches,
    };
  }

  async getStudyMetadata(orthancStudyId: string): Promise<OrthancStudyMetadata | null> {
    return this.mockStudies.find((s) => s.orthancStudyId === orthancStudyId) || null;
  }

  async findStudyByStudyInstanceUid(studyInstanceUid: string): Promise<OrthancStudyMetadata | null> {
    if (this.outcome === 'failure' || !studyInstanceUid || studyInstanceUid.trim().length === 0) {
      return null;
    }
    const match = this.mockStudies.find(
      (s) => s.studyInstanceUid && s.studyInstanceUid.trim() === studyInstanceUid.trim()
    );
    if (match) return match;
    if (this.outcome === 'success') {
      return {
        orthancStudyId: `MOCK-${studyInstanceUid.slice(-8)}`,
        accessionNumber: 'MOCK-ACCESSION',
        patientId: 'MOCK-PATIENT',
        patientName: 'MOCK-NAME',
        studyInstanceUid: studyInstanceUid.trim(),
        studyDate: '20260101',
        studyDescription: 'Mock PACS Study',
        modalitiesInStudy: ['CT'],
      };
    }
    return null;
  }

  async requestHandoff(_context: PacsHandoffContext): Promise<PacsHandoffResult> {
    const now = new Date();

    if (this.outcome === 'failure') {
      return {
        success: false,
        errorCode: 'PACS_UNAVAILABLE',
        errorMessage: 'Demo PACS Adapter: Simulated downstream PACS storage service unavailable.',
        simulatedTimestamp: now,
        adapterIdentifier: 'Demo PACS Adapter (Simulated)',
      };
    }

    if (this.outcome === 'fail_once') {
      this.failOnceAttemptCount += 1;
      if (this.failOnceAttemptCount === 1) {
        return {
          success: false,
          errorCode: 'HANDOFF_TIMEOUT',
          errorMessage: 'Demo PACS Adapter: Simulated gateway connection timeout during initial handoff attempt.',
          simulatedTimestamp: now,
          adapterIdentifier: 'Demo PACS Adapter (Simulated)',
        };
      }
    }

    return {
      success: true,
      simulatedTimestamp: now,
      adapterIdentifier: 'Demo PACS Adapter (Simulated)',
    };
  }

  async getStudySeriesAndInstances(orthancStudyId: string): Promise<DicomSeriesSummary[]> {
    return [
      {
        seriesInstanceUid: `1.2.826.0.1.3680043.8.498.${orthancStudyId}.1`,
        seriesNumber: 1,
        modality: 'CT',
        seriesDescription: 'Simulated Axial Series',
        numberOfInstances: 5,
        instances: Array.from({ length: 5 }, (_, i) => ({
          sopInstanceUid: `1.2.826.0.1.3680043.8.498.${orthancStudyId}.1.${i + 1}`,
          instanceNumber: i + 1,
          sliceLocation: (i + 1) * 2.5,
        })),
      },
    ];
  }

  async getStudyArchive(_orthancStudyId: string): Promise<Buffer | null> {
    if (this.outcome === 'failure') {
      throw new Error('Demo PACS Adapter: Simulated downstream PACS storage service unavailable.');
    }
    return null;
  }
}
