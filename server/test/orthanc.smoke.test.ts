import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OrthancPacsGateway } from '../src/integrations/pacs/orthancPacsGateway';
import { PacsStudyLookupOutcome } from '../src/integrations/pacs/pacsGateway.interface';

describe('Real Orthanc PACS Live Smoke Test (Requires manrad-orthanc container)', () => {
  const orthancUrl = process.env.ORTHANC_URL || 'http://localhost:8042';
  const orthancUser = process.env.ORTHANC_USERNAME || 'orthanc';
  const orthancPassword = process.env.ORTHANC_PASSWORD || '';

  const liveGateway = new OrthancPacsGateway({
    baseUrl: orthancUrl,
    username: orthancUser,
    password: orthancPassword,
    timeoutMs: 5000,
  });

  it('connects to live Orthanc REST API and validates system information', async () => {
    const health = await liveGateway.checkHealth();
    assert.strictEqual(
      health.connected,
      true,
      `Failed to connect to Orthanc at ${orthancUrl}. Ensure manrad-orthanc container is running.`
    );
    assert.strictEqual(health.serverName, 'Manrad RIS PACS');
    assert.ok(health.version, 'Orthanc version must be populated');
    assert.ok(health.apiVersion, 'Orthanc API version must be populated');
    assert.strictEqual(health.dicomAet, 'MANRAD');
    assert.ok(health.checkedAt instanceof Date);
  });

  it('discovers live Orthanc plugins and identifies dicom-web', async () => {
    const health = await liveGateway.checkHealth();
    assert.strictEqual(health.connected, true);
    assert.strictEqual(
      health.dicomWebPluginAvailable,
      true,
      'dicom-web plugin must be loaded and discovered in manrad-orthanc container'
    );
  });

  it('exposes accurate live capabilities with honest non-transfer boundary', async () => {
    const caps = await liveGateway.getCapabilities();
    assert.strictEqual(caps.adapter, 'orthanc');
    assert.strictEqual(caps.connected, true);
    assert.strictEqual(caps.serverName, 'Manrad RIS PACS');
    assert.strictEqual(caps.metadataLookupSupported, true);
    assert.strictEqual(caps.reconciliationSupported, true);
    assert.strictEqual(caps.dicomWebPluginAvailable, true);
    assert.strictEqual(
      caps.dicomTransferSupported,
      false,
      'OrthancPacsGateway must honestly expose dicomTransferSupported = false'
    );
    assert.strictEqual(caps.viewerSupported, false);
  });

  it('performs live REST study find for non-existent accession and returns NOT_FOUND', async () => {
    const lookup = await liveGateway.findStudyByAccession('ACC-NONEXISTENT-LIVE-SMOKE-TEST');
    assert.strictEqual(lookup.outcome, PacsStudyLookupOutcome.NOT_FOUND);
    assert.strictEqual(lookup.studies.length, 0);
  });

  it('strictly rejects requestHandoff with HTTP 409 conflict in live Orthanc mode', async () => {
    await assert.rejects(
      async () => {
        await liveGateway.requestHandoff({
          imagingOrderId: 'ord-smoke',
          accessionNumber: 'ACC-SMOKE-01',
          patientId: 'PAT-SMOKE-01',
          patientInternalId: 'pid-smoke',
          modality: 'CT',
          examination: 'CT Chest Live Smoke',
          protocolCode: null,
          scanLifecycleId: 'scan-smoke',
          attemptNumber: 1,
          equipmentId: null,
          equipmentName: null,
          imageQualityReviewId: 'qa-smoke',
          reviewedByUserId: 'usr-smoke',
          reviewedAt: new Date(),
        });
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, 'PACS_TRANSFER_NOT_AVAILABLE');
        assert.ok(err.message.includes('does not yet have a DICOM payload to transmit'));
        return true;
      }
    );
  });
});

