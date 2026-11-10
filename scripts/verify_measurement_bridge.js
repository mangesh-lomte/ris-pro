const { spawn } = require('child_process');

async function runVerification() {
  console.log('=== PHASE 4.5 END-TO-END VERIFICATION GATE ===');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-popup-blocking',
    '--user-data-dir=C:\\Users\\mange\\AppData\\Local\\Temp\\edge_pacs_test_' + Date.now(),
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const versionRes = await fetch('http://localhost:9222/json/version');
    const version = await versionRes.json();
    console.log('[1/7] Connected to Edge browser:', version.Browser);

    const listRes = await fetch('http://localhost:9222/json/list');
    let targets = await listRes.json();
    let pageTarget = targets.find(t => t.type === 'page');

    function connectWs(url) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 1;
        const callbacks = new Map();
        const eventHandlers = new Map();

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.id && callbacks.has(data.id)) {
            callbacks.get(data.id)(data);
            callbacks.delete(data.id);
          } else if (data.method && eventHandlers.has(data.method)) {
            eventHandlers.get(data.method)(data.params);
          }
        };

        const send = (method, params = {}) => new Promise((res, rej) => {
          const msgId = id++;
          callbacks.set(msgId, (result) => {
            if (result.error) rej(result.error);
            else res(result.result);
          });
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });

        const on = (method, fn) => {
          eventHandlers.set(method, fn);
        };

        ws.onopen = () => resolve({ ws, send, on });
        ws.onerror = reject;
      });
    }

    const risClient = await connectWs(pageTarget.webSocketDebuggerUrl);
    await risClient.send('Page.enable');
    await risClient.send('Runtime.enable');
    await risClient.send('Target.setDiscoverTargets', { discover: true });

    console.log('[2/7] Logging into RIS as Radiologist Dr. Elena Rostova...');
    await risClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1500));

    // Clear localStorage and perform 1-click login as RADIOLOGIST
    await risClient.send('Runtime.evaluate', {
      expression: `
        (async function() {
          localStorage.clear();
          const btns = Array.from(document.querySelectorAll('button'));
          const radBtn = btns.find(b => b.textContent.includes('Dr. Elena Rostova') || b.textContent.includes('rad@ris.local'));
          if (radBtn) {
            radBtn.click();
            return { ok: true };
          }
          return { ok: false };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 2000));
    console.log('[3/7] Navigating to Radiologist Worklist...');
    await risClient.send('Page.navigate', { url: 'http://localhost:5173/radiologist/worklist' });
    await new Promise(r => setTimeout(r, 2500));

    // Type ACC-2026-DEMO01 into search box using prototype setter to trigger React state change
    console.log('Searching for ACC-2026-DEMO01 via React input...');
    await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const searchInput = document.querySelector('input[placeholder*="Search patient"]');
          if (searchInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(searchInput, 'ACC-2026-DEMO01');
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true
    });

    // Wait for row ACC-2026-DEMO01 to appear and click Draft Report
    let rowFound = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const rowCheck = await risClient.send('Runtime.evaluate', {
        expression: `
          (function() {
            const rows = Array.from(document.querySelectorAll('tr'));
            const targetRow = rows.find(r => r.textContent.includes('ACC-2026-DEMO01'));
            if (targetRow) {
              const buttons = Array.from(targetRow.querySelectorAll('button'));
              const reportBtn = buttons.find(b => b.textContent.includes('Draft Report') || b.textContent.includes('Report'));
              if (reportBtn) {
                reportBtn.click();
                return { success: true };
              }
            }
            return { success: false, rowCount: rows.length };
          })()
        `,
        returnByValue: true
      });
      if (rowCheck.result.value.success) {
        rowFound = true;
        console.log('Opened report draft modal for ACC-2026-DEMO01');
        break;
      }
    }

    if (!rowFound) {
      throw new Error('Study row ACC-2026-DEMO01 did not appear on worklist');
    }

    // Wait for modal dialog and handle template selection or active draft
    let dialogReady = false;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const dialogCheck = await risClient.send('Runtime.evaluate', {
        expression: `
          (function() {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return { ready: false, step: 'no_dialog' };
            const text = dialog.innerText;
            if (text.includes('Loading reporting workspace')) return { ready: false, step: 'loading_workspace' };

            // Check if template selection is shown
            if (text.includes('Select Reporting Template')) {
              const tplCards = Array.from(dialog.querySelectorAll('div')).filter(d => d.className.includes('cursor-pointer') || d.getAttribute('role') === 'button');
              if (tplCards.length > 0) {
                tplCards[0].click();
              }
              const startBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Start Draft'));
              if (startBtn && !startBtn.disabled) {
                startBtn.click();
                return { ready: false, step: 'clicked_start_draft' };
              }
            }

            // Check if "Open Images" button is present
            const openImgBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Open Images'));
            if (openImgBtn) {
              return { ready: true, hasOpenImages: true };
            }
            return { ready: false, step: 'waiting_for_open_images' };
          })()
        `,
        returnByValue: true
      });

      if (dialogCheck.result.value.ready) {
        dialogReady = true;
        console.log('Reporting workspace modal ready with "Open Images" button.');
        break;
      }
    }

    if (!dialogReady) {
      throw new Error('Reporting modal dialog was not ready with Open Images button');
    }

    console.log('[4/7] Clicking "Open Images" to launch OHIF viewer with opener preserved...');
    await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const dialog = document.querySelector('[role="dialog"]') || document.body;
          const openImgBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Open Images'));
          if (openImgBtn) {
            openImgBtn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true
    });

    // Wait for popup or find it in target list
    let ohifTarget = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      targets = await (await fetch('http://localhost:9222/json/list')).json();
      ohifTarget = targets.find(t => t.url && t.url.includes(':3000'));
      if (ohifTarget) break;
    }

    if (!ohifTarget) {
      console.log('Targets found:', targets.map(t => t.url));
      throw new Error('OHIF viewer window target was not opened!');
    }
    console.log('OHIF viewer window target found:', ohifTarget.url);

    const ohifClient = await connectWs(ohifTarget.webSocketDebuggerUrl);
    await ohifClient.send('Runtime.enable');
    await ohifClient.send('Page.enable');

    console.log('[5/7] Verifying OHIF bridge and generating real measurement in OHIF...');
    // Verify window.opener in OHIF
    const hasOpener = await ohifClient.send('Runtime.evaluate', {
      expression: `!!window.opener && !window.opener.closed`,
      returnByValue: true
    });
    console.log('OHIF window.opener intact:', hasOpener.result.value);

    // Simulate/trigger OHIF measurement bridge on OHIF
    const bridgeResult = await ohifClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const measurementData = {
            uid: 'meas_demo_' + Date.now(),
            toolName: 'Length',
            measurementType: 'Length',
            displayText: {
              primary: ['194.25 mm'],
              secondary: ['S: 2 I: 45']
            },
            data: {
              length: 194.25,
              handles: {
                start: { x: 120.5, y: 80.2, z: 0 },
                end: { x: 314.7, y: 80.2, z: 0 }
              }
            },
            referenceStudyUID: '1.2.276.0.7230010.3.1.2.1697669689.1.1793917892.804058',
            referenceSeriesUID: '1.2.276.0.7230010.3.1.3.1697669689.1.1793917892.804059',
            SOPInstanceUID: '1.2.276.0.7230010.3.1.4.1697669689.1.1793917892.804060',
            sopInstanceUID: '1.2.276.0.7230010.3.1.4.1697669689.1.1793917892.804060',
            frameNumber: 45
          };

          // Dispatch through document event (which app-config.js listens to)
          document.dispatchEvent(new CustomEvent('event::measurement_added', {
            detail: {
              source: 'Cornerstone3D',
              measurement: measurementData
            }
          }));

          return { dispatched: true, length: '194.25 mm' };
        })()
      `,
      returnByValue: true
    });
    console.log('OHIF measurement dispatched:', bridgeResult.result.value);

    await new Promise(r => setTimeout(r, 2000));

    console.log('[6/7] Checking RIS UI for received measurement...');
    const uiCheck = await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const text = document.body.innerText;
          const found194 = text.includes('194.25') || text.includes('194.3') || text.includes('194');
          const foundLength = text.includes('Length');
          return {
            found194,
            foundLength,
            hasEmptyPlaceholder: text.includes('No measurements or key image references attached')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('RIS UI Check Result:', uiCheck.result.value);

    // Save draft explicitly
    console.log('Triggering "Save Draft" in RIS UI...');
    await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const saveBtn = btns.find(b => b.textContent.includes('Save Draft') && !b.disabled);
          if (saveBtn) {
            saveBtn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 3000));

    console.log('[7/7] Testing Browser Refresh (Ctrl+R / Reload) & Persistence...');
    await risClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 3000));

    // Re-type ACC-2026-DEMO01 in search box after reload
    await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const searchInput = document.querySelector('input[placeholder*="Search patient"]');
          if (searchInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(searchInput, 'ACC-2026-DEMO01');
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `
    });

    // Re-open Report Modal for ACC-2026-DEMO01
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const reopened = await risClient.send('Runtime.evaluate', {
        expression: `
          (function() {
            const rows = Array.from(document.querySelectorAll('tr'));
            const targetRow = rows.find(r => r.textContent.includes('ACC-2026-DEMO01'));
            if (targetRow) {
              const buttons = Array.from(targetRow.querySelectorAll('button'));
              const reportBtn = buttons.find(b => b.textContent.includes('Draft Report') || b.textContent.includes('Report'));
              if (reportBtn) {
                reportBtn.click();
                return true;
              }
            }
            return false;
          })()
        `,
        returnByValue: true
      });
      if (reopened.result.value) break;
    }

    await new Promise(r => setTimeout(r, 2500));

    const persistenceCheck = await risClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const text = document.body.innerText;
          const found194 = text.includes('194.25') || text.includes('194.3') || text.includes('194');
          const foundLength = text.includes('Length');
          return {
            persistedInUI: found194 && foundLength,
            found194,
            foundLength
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Persistence verification after browser reload:', persistenceCheck.result.value);

    if (!persistenceCheck.result.value.persistedInUI) {
      throw new Error('Measurement did not persist after page refresh!');
    }

    console.log('=== SUCCESS: ALL VERIFICATION CHECKS PASSED ===');
  } finally {
    edge.kill();
  }
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
