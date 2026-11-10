// OHIF Configuration & Real Measurement Bridge for Manrad RIS
(function() {
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
          friendlyName: 'Manrad Orthanc PACS',
          name: 'MANRAD_ORTHANC',
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

  // Helper to extract measurement values safely
  function extractNumericAndUnit(m) {
    var numVal = null;
    var unit = 'mm';

    if (typeof m.length === 'number') {
      numVal = m.length;
    } else if (typeof m.area === 'number') {
      numVal = m.area;
      unit = 'mm\xB2';
    }

    if (numVal == null && m.data) {
      if (typeof m.data.length === 'number') {
        numVal = m.data.length;
      } else if (typeof m.data.area === 'number') {
        numVal = m.data.area;
        unit = 'mm\xB2';
      } else if (typeof m.data === 'object') {
        for (var k in m.data) {
          var stat = m.data[k];
          if (stat && typeof stat.length === 'number') {
            numVal = stat.length;
            if (stat.unit) unit = stat.unit;
            break;
          } else if (stat && typeof stat.area === 'number') {
            numVal = stat.area;
            unit = stat.unit || 'mm\xB2';
            break;
          }
        }
      }
    }

    var displayStr = '';
    if (typeof m.displayText === 'string') {
      displayStr = m.displayText;
    } else if (m.displayText && typeof m.displayText === 'object') {
      var prim = Array.isArray(m.displayText.primary) ? m.displayText.primary.join(' ') : '';
      var sec = Array.isArray(m.displayText.secondary) ? m.displayText.secondary.join(' ') : '';
      displayStr = (prim + ' ' + sec).trim();
    }

    if (numVal == null && displayStr) {
      var match = displayStr.match(/([\d.]+)\s*([a-zA-Z\xB2\xB3]+)?/);
      if (match) {
        numVal = parseFloat(match[1]);
        if (match[2]) unit = match[2];
      }
    }

    if (numVal != null && typeof numVal === 'number' && !isNaN(numVal)) {
      numVal = Number(numVal.toFixed(2));
    } else {
      numVal = 0;
    }

    return { numVal: numVal, unit: unit, displayStr: displayStr };
  }

  // Broadcast measurement to opener RIS window
  function broadcastMeasurement(action, rawData) {
    try {
      if (!window.opener || window.opener.closed) {
        console.warn('[OHIF->RIS] No window.opener found to send measurement');
        return;
      }

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

      var studyUid = m.referenceStudyUID || m.StudyInstanceUID || '';
      if (!studyUid) {
        var urlParams = new URLSearchParams(window.location.search);
        var qStudy = urlParams.get('StudyInstanceUIDs');
        if (qStudy) studyUid = qStudy.split(',')[0].trim();
      }

      var seriesUid = m.referenceSeriesUID || m.SeriesInstanceUID || '';
      var sopUid = m.SOPInstanceUID || '';
      var frameNo = typeof m.frameNumber === 'number' ? m.frameNumber : 1;

      var messageType = (action === 'UPDATED') ? 'RIS_MEASUREMENT_UPDATED' : 'RIS_MEASUREMENT_ADDED';

      var payload = {
        type: messageType,
        measurement: {
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
        }
      };

      console.log('[OHIF->RIS] Emitting measurement to RIS:', payload);
      window.opener.postMessage(payload, '*');
    } catch (err) {
      console.error('[OHIF->RIS] Failed to format or post measurement:', err);
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

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'RIS_KEY_IMAGE_CAPTURED',
          keyImage: {
            id: 'key-' + Date.now(),
            studyInstanceUid: studyUid,
            seriesInstanceUid: seriesUid,
            sopInstanceUid: sopUid,
            label: evt.data.label || 'Key Image Reference',
            notes: evt.data.notes || '',
            createdAt: new Date().toISOString()
          }
        }, '*');
      }
    } catch (e) {
      console.warn('[OHIF] Key image capture failed:', e);
    }
  });
})();
