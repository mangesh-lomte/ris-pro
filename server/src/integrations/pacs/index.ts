import { PacsGateway } from './pacsGateway.interface';
import { MockPacsGateway, MockPacsOutcome } from './mockPacsGateway';
import { OrthancPacsGateway } from './orthancPacsGateway';

let activeGateway: PacsGateway | null = null;
let currentAdapter: 'mock' | 'orthanc' | null = null;

export function createPacsGateway(adapter?: 'mock' | 'orthanc'): PacsGateway {
  const chosenAdapter = adapter || (process.env.PACS_ADAPTER as 'mock' | 'orthanc') || 'mock';

  if (chosenAdapter === 'orthanc') {
    const baseUrl = process.env.ORTHANC_URL || 'http://localhost:8042';
    const username = process.env.ORTHANC_USERNAME || '';
    const password = process.env.ORTHANC_PASSWORD || '';
    const timeoutMs = process.env.ORTHANC_TIMEOUT_MS ? parseInt(process.env.ORTHANC_TIMEOUT_MS, 10) : 5000;
    return new OrthancPacsGateway({ baseUrl, username, password, timeoutMs });
  }

  const defaultOutcome = (process.env.PACS_MOCK_OUTCOME as MockPacsOutcome) || 'success';
  return new MockPacsGateway(defaultOutcome);
}

export function getPacsGateway(): PacsGateway {
  if (!activeGateway) {
    const targetAdapter = (process.env.PACS_ADAPTER as 'mock' | 'orthanc') || 'mock';
    activeGateway = createPacsGateway(targetAdapter);
    currentAdapter = targetAdapter;
  }
  return activeGateway;
}

export function getCurrentPacsAdapter(): 'mock' | 'orthanc' | null {
  return currentAdapter;
}

export function setPacsGateway(gateway: PacsGateway): void {
  activeGateway = gateway;
  currentAdapter = gateway instanceof OrthancPacsGateway ? 'orthanc' : 'mock';
}

export function resetPacsGateway(): void {
  activeGateway = null;
  currentAdapter = null;
}

export function setMockPacsOutcome(outcome: MockPacsOutcome): void {
  const gateway = getPacsGateway();
  if (gateway instanceof MockPacsGateway) {
    gateway.setOutcome(outcome);
  }
}

export function resetMockPacs(): void {
  const gateway = getPacsGateway();
  if (gateway instanceof MockPacsGateway) {
    gateway.reset();
  }
}

export * from './pacsGateway.interface';
export * from './mockPacsGateway';
export * from './orthancPacsGateway';
