// OHIF Configuration & Real Measurement Bridge for RadAxis RIS
(function() {
  // Ensure full width viewport layout
  try {
    var styleEl = document.createElement('style');
    styleEl.innerHTML = '.viewport-wrapper { flex: 1 1 0% !important; width: 100% !important; }';
    document.head.appendChild(styleEl);
  } catch (e) {}
  var ohifBaseConfig = {
    routerBasename: '/',
    extensions: [],
    modes: [],
    showStudyList: true,
    dataSources: [
      {
        namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
        sourceName: 'dicomweb',
        configuration: {
          friendlyName: 'RadAxis Orthanc PACS',
          name: 'RADAXIS_ORTHANC',
          qidoRoot: '/dicom-web',
          wadoRoot: '/dicom-web',
          wadoUriRoot: '/wado',
          qidoSupportsIncludeField: false,
          imageRendering: 'wadors',
          thumbnailRendering: 'wadors',
          enableStudyLazyLoad: true,
          supportsFuzzyMatching: false,
          supportsWildcard: false,
          supportsReject: false,
          dicomUploadEnabled: false,
          omitQuotationForMultipartRequest: true
        }
      }
    ],
    defaultDataSourceName: 'dicomweb'
  };

  // Dual-mode config: works as function or plain object with properties
  window.config = function(params) {
    if (params && params.servicesManager) {
      initBridgeWithServicesManager(params.servicesManager);
    }
    return ohifBaseConfig;
  };
  window.config.routerBasename = '/';
  window.config.showStudyList = true;
  window.config.dataSources = ohifBaseConfig.dataSources;
  window.config.defaultDataSourceName = 'dicomweb';
  window.config.extensions = [];
  window.config.modes = [];

  // Helper to extract measurement values safely with strict clinical unit fidelity
  function extractNumericAndUnit(m) {
    var numVal = null;
    var unit = (m && m.unit) ? m.unit : 'mm';

    // 1. Direct tool properties from OHIF measurement service
    if (typeof m.length === 'number') {
      numVal = m.length;
      unit = m.unit || 'mm';
    } else if (typeof m.shortestDiameter === 'number' && typeof m.longestDiameter === 'number') {
      // Bidirectional tool
      numVal = m.longestDiameter;
      unit = m.unit || 'mm';
    } else if (typeof m.angle === 'number') {
      // Angle / CobbAngle tool
      numVal = m.angle;
      unit = m.unit || 'deg';
    } else if (typeof m.area === 'number') {
      // ROI tools (Circle, Ellipse, Rectangle, Freehand)
      numVal = m.area;
      unit = m.unit || 'mm\xB2';
    } else if (typeof m.mean === 'number') {
      // Probe / ROI mean HU value
      numVal = m.mean;
      unit = m.unit || 'HU';
    } else if (typeof m.value === 'number') {
      numVal = m.value;
      if (m.unit) unit = m.unit;
    }

    // 2. Check inner stats object from Cornerstone annotation data
    if (numVal == null && m.data) {
      if (typeof m.data.length === 'number') {
        numVal = m.data.length;
        unit = m.data.unit || 'mm';
      } else if (typeof m.data.angle === 'number') {
        numVal = m.data.angle;
        unit = m.data.unit || 'deg';
      } else if (typeof m.data.area === 'number') {
        numVal = m.data.area;
        unit = m.data.unit || 'mm\xB2';
      } else if (typeof m.data === 'object') {
        for (var k in m.data) {
          var stat = m.data[k];
          if (!stat || typeof stat !== 'object') continue;
          if (typeof stat.length === 'number') {
            numVal = stat.length;
            if (stat.unit) unit = stat.unit;
            break;
          } else if (typeof stat.angle === 'number') {
            numVal = stat.angle;
            unit = stat.unit || 'deg';
            break;
          } else if (typeof stat.area === 'number') {
            numVal = stat.area;
            unit = stat.unit || 'mm\xB2';
            break;
          } else if (typeof stat.mean === 'number') {
            numVal = stat.mean;
            unit = stat.unit || 'HU';
            break;
          } else if (Array.isArray(stat.statsArray)) {
            for (var sIdx = 0; sIdx < stat.statsArray.length; sIdx++) {
              var sItem = stat.statsArray[sIdx];
              if (sItem && typeof sItem.value === 'number') {
                numVal = sItem.value;
                if (sItem.unit) unit = sItem.unit;
                break;
              }
            }
            if (numVal != null) break;
          }
        }
      }
    }

    // 3. Extract display string from OHIF UI representation
    var displayStr = '';
    if (typeof m.displayText === 'string') {
      displayStr = m.displayText;
    } else if (m.displayText && typeof m.displayText === 'object') {
      var prim = Array.isArray(m.displayText.primary) ? m.displayText.primary.join(' ') : '';
      var sec = Array.isArray(m.displayText.secondary) ? m.displayText.secondary.join(' ') : '';
      displayStr = (prim + ' ' + sec).trim();
    }

    // 4. If displayStr exists, check if it specifies exact displayed number and unit
    if (displayStr) {
      var match = displayStr.match(/([\d.]+)\s*([a-zA-Z\xB2\xB3\u00B0]+)?/);
      if (match) {
        var parsedVal = parseFloat(match[1]);
        if (!isNaN(parsedVal)) {
          if (numVal == null) numVal = parsedVal;
          if (match[2]) {
            var parsedUnit = match[2];
            if (parsedUnit === '\u00B0' || parsedUnit === 'deg') unit = 'deg';
            else if (parsedUnit === 'mm2' || parsedUnit === 'mm\xB2') unit = 'mm\xB2';
            else if (parsedUnit.toLowerCase() === 'hu') unit = 'HU';
            else if (parsedUnit.toLowerCase() === 'mm') unit = 'mm';
            else unit = parsedUnit;
          }
        }
      }
    }

    // 5. Ensure tool-type specific unit safety: Angle/ROI tools never get incorrectly labeled as mm
    var toolName = String(m.toolName || m.type || '').toLowerCase();
    if (toolName.includes('angle') && unit === 'mm') {
      unit = 'deg';
    } else if ((toolName.includes('roi') || toolName.includes('area')) && unit === 'mm') {
      unit = 'mm\xB2';
    } else if (toolName.includes('probe') && unit === 'mm') {
      unit = 'HU';
    }

    if (numVal != null && typeof numVal === 'number' && !isNaN(numVal)) {
      numVal = Number(numVal.toFixed(2));
    } else {
      numVal = 0;
    }

    return { numVal: numVal, unit: unit, displayStr: displayStr };
  }

  // Broadcast measurement across all communication channels to RIS
  function broadcastMeasurement(action, rawData) {
    try {
      var m = (rawData && rawData.measurement) || rawData;
      if (!m) return;

      var parsed = extractNumericAndUnit(m);
      var numVal = parsed.numVal;
      var unit = parsed.unit;
      var displayStr = parsed.displayStr;

      // Clean geometry coordinates
      var cleanGeometry = null;
      if (Array.isArray(m.points)) {
        cleanGeometry = m.points.map(function(pt) {
          if (Array.isArray(pt)) return [pt[0], pt[1], pt[2]];
          if (pt && typeof pt === 'object') return { x: pt.x, y: pt.y, z: pt.z };
          return pt;
        });
      }

      var urlParams = new URLSearchParams(window.location.search);
      var studyUid = m.referenceStudyUID || m.StudyInstanceUID || '';
      if (!studyUid) {
        var qStudy = urlParams.get('StudyInstanceUIDs');
        if (qStudy) studyUid = qStudy.split(',')[0].trim();
      }

      var seriesUid = m.referenceSeriesUID || m.SeriesInstanceUID || '';
      var sopUid = m.SOPInstanceUID || '';
      var frameNo = typeof m.frameNumber === 'number' ? m.frameNumber : 1;
      var orderId = urlParams.get('orderId') || '';
      var accession = urlParams.get('accession') || '';
      var patientId = urlParams.get('patientId') || '';

      var messageType = (action === 'UPDATED') ? 'RIS_MEASUREMENT_UPDATED' : 'RIS_MEASUREMENT_ADDED';

      var measurementData = {
        id: String(m.uid || ('meas-' + Date.now())),
        toolType: String(m.toolName || m.type || 'Length'),
        label: m.label ? String(m.label) : ((m.toolName || 'Length') + (numVal ? ' (' + numVal + ' ' + unit + ')' : '')),
        numericValue: numVal,
        unit: unit,
        displayText: displayStr || (numVal ? (numVal + ' ' + unit) : ''),
        geometry: cleanGeometry,
        studyInstanceUid: String(studyUid),
        seriesInstanceUid: String(seriesUid),
        sopInstanceUid: String(sopUid),
        frameNumber: frameNo,
        createdAt: new Date().toISOString()
      };

      var payload = {
        type: messageType,
        orderId: orderId,
        accessionNumber: accession,
        patientId: patientId,
        measurement: measurementData
      };

      console.log('[OHIF->RIS] Broadcasting measurement across channels:', payload);

      // Channel 1: window.opener postMessage (if opener present)
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
        }
      } catch (e1) {
        console.warn('[OHIF->RIS] Opener postMessage error:', e1);
      }

      // Channel 2: BroadcastChannel (cross-tab sync on same origin)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var bc = new BroadcastChannel('radaxis-dicom-sync');
          bc.postMessage(payload);
          setTimeout(function() { bc.close(); }, 500);
        }
      } catch (e2) {
        console.warn('[OHIF->RIS] BroadcastChannel error:', e2);
      }

      // Channel 3: LocalStorage storage event
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('radaxis_dicom_sync', JSON.stringify({
            type: payload.type,
            orderId: payload.orderId,
            accessionNumber: payload.accessionNumber,
            patientId: payload.patientId,
            measurement: payload.measurement,
            _ts: Date.now()
          }));
        }
      } catch (e3) {
        console.warn('[OHIF->RIS] LocalStorage error:', e3);
      }

      // Channel 4: Direct HTTP POST to RIS backend API
      var targetId = orderId || accession;
      if (targetId) {
        try {
          fetch('/api/v1/radiologist/worklist/' + encodeURIComponent(targetId) + '/measurements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              measurement: measurementData
            })
          }).then(function(res) {
            console.log('[OHIF->RIS] Direct POST measurement persisted status:', res.status);
          }).catch(function(err) {
            console.warn('[OHIF->RIS] Direct POST measurement failed:', err);
          });
        } catch (e4) {
          console.warn('[OHIF->RIS] Direct fetch invocation error:', e4);
        }
      }
    } catch (err) {
      console.error('[OHIF->RIS] Failed to format or broadcast measurement:', err);
    }
  }

  var isSubscribed = false;
  function initBridgeWithServicesManager(sm) {
    if (isSubscribed) return;
    try {
      var ms = (sm && sm.services && sm.services.measurementService) || (window.services && window.services.measurementService);
      if (!ms) return;

      isSubscribed = true;
      console.log('[OHIF->RIS] Initializing MeasurementService bridge');

      if (ms.EVENTS && ms.EVENTS.MEASUREMENT_ADDED) {
        ms.subscribe(ms.EVENTS.MEASUREMENT_ADDED, function(data) { broadcastMeasurement('ADDED', data); });
      }
      if (ms.EVENTS && ms.EVENTS.MEASUREMENT_UPDATED) {
        ms.subscribe(ms.EVENTS.MEASUREMENT_UPDATED, function(data) { broadcastMeasurement('UPDATED', data); });
      }
      if (ms.EVENTS && ms.EVENTS.RAW_MEASUREMENT_ADDED) {
        ms.subscribe(ms.EVENTS.RAW_MEASUREMENT_ADDED, function(data) { broadcastMeasurement('ADDED', data); });
      }
    } catch (e) {
      console.warn('[OHIF->RIS] Service manager subscription error:', e);
    }
  }

  // Also bind document custom events dispatched by PubSubService
  document.addEventListener('event::measurement_added', function(e) {
    broadcastMeasurement('ADDED', e.detail);
  });
  document.addEventListener('event::measurement_updated', function(e) {
    broadcastMeasurement('UPDATED', e.detail);
  });

  // Polling fallback to guarantee subscription when window.services mounts
  var pollCount = 0;
  var pollInterval = setInterval(function() {
    pollCount++;
    if (window.services && window.services.measurementService) {
      initBridgeWithServicesManager(window.services);
      clearInterval(pollInterval);
    }
    if (pollCount > 100) clearInterval(pollInterval);
  }, 100);

  // Key Image request listener
  window.addEventListener('message', function(evt) {
    if (!evt.data || evt.data.type !== 'RIS_CAPTURE_KEY_IMAGE_REQUEST') return;
    try {
      var vg = window.services && window.services.viewportGridService;
      var ds = window.services && window.services.displaySetService;
      var gridState = vg && vg.getState ? vg.getState() : null;
      var activeViewportId = gridState && gridState.activeViewportId;
      var activeViewport = gridState && gridState.viewports && gridState.viewports.get ? gridState.viewports.get(activeViewportId) : null;
      var displaySetInstanceUID = activeViewport && activeViewport.displaySetInstanceUID;
      var displaySet = displaySetInstanceUID && ds && ds.getDisplaySetByUID ? ds.getDisplaySetByUID(displaySetInstanceUID) : null;

      var studyUid = (displaySet && displaySet.StudyInstanceUID) || (activeViewport && activeViewport.StudyInstanceUID);
      var seriesUid = (displaySet && displaySet.SeriesInstanceUID) || (activeViewport && activeViewport.SeriesInstanceUID);
      var sopUid = (displaySet && displaySet.images && displaySet.images[0] && displaySet.images[0].SOPInstanceUID) || (displaySet && displaySet.SOPInstanceUID);

      var urlParams = new URLSearchParams(window.location.search);
      if (!studyUid) {
        var qStudy = urlParams.get('StudyInstanceUIDs');
        if (qStudy) studyUid = qStudy.split(',')[0].trim();
      }
      var orderId = urlParams.get('orderId') || '';
      var accession = urlParams.get('accession') || '';

      var keyPayload = {
        type: 'RIS_KEY_IMAGE_CAPTURED',
        orderId: orderId,
        accessionNumber: accession,
        keyImage: {
          id: 'key-' + Date.now(),
          studyInstanceUid: studyUid,
          seriesInstanceUid: seriesUid,
          sopInstanceUid: sopUid,
          label: evt.data.label || 'Key Image Reference',
          description: evt.data.notes || evt.data.description || '',
          createdAt: new Date().toISOString()
        }
      };

      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(keyPayload, '*'); } catch (e1) {}
      }
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          var bc = new BroadcastChannel('radaxis-dicom-sync');
          bc.postMessage(keyPayload);
          setTimeout(function() { bc.close(); }, 500);
        } catch (e2) {}
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('radaxis_dicom_sync', JSON.stringify({ ...keyPayload, _ts: Date.now() }));
        } catch (e3) {}
      }
    } catch (e) {
      console.warn('[OHIF] Key image capture failed:', e);
    }
  });
})();
