/**
 * Phase 4.4 — Dictation / Speech-to-Text Service & Adapter
 *
 * Provides a clean adapter abstraction for speech recognition.
 * Uses browser-native Web Speech API without external cloud dependencies or raw audio storage.
 */

export type DictationState =
  | 'ready'
  | 'listening'
  | 'processing'
  | 'stopped'
  | 'unavailable'
  | 'permission_denied'
  | 'error';

export interface SpeechToTextCallbacks {
  onStateChange: (state: DictationState, message?: string) => void;
  onTranscriptChunk: (chunk: string, isFinal: boolean) => void;
  onError: (errorMessage: string, state: DictationState) => void;
}

export interface SpeechToTextProvider {
  readonly id: string;
  readonly name: string;
  isSupported(): boolean;
  start(callbacks: SpeechToTextCallbacks): Promise<void> | void;
  stop(): void;
  abort(): void;
  getState(): DictationState;
}

/**
 * Text insertion utility.
 * Inserts or appends a transcript chunk into an existing section text.
 * Never overwrites existing content.
 */
export function insertTranscriptIntoSection(
  currentText: string,
  transcriptChunk: string,
  cursorPosition?: number | null
): { newText: string; newCursor: number } {
  const trimmedChunk = transcriptChunk.trim();
  if (!trimmedChunk) {
    return { newText: currentText, newCursor: cursorPosition ?? (currentText ? currentText.length : 0) };
  }

  const safeCurrent = currentText || '';

  // If cursor position is valid and within bounds
  if (typeof cursorPosition === 'number' && cursorPosition >= 0 && cursorPosition <= safeCurrent.length) {
    const before = safeCurrent.slice(0, cursorPosition);
    const after = safeCurrent.slice(cursorPosition);

    const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
    const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);

    const insertion = `${needsLeadingSpace ? ' ' : ''}${trimmedChunk}${needsTrailingSpace ? ' ' : ''}`;
    const newText = before + insertion + after;
    const newCursor = before.length + insertion.length;
    return { newText, newCursor };
  }

  // Section-level append behavior
  if (!safeCurrent || safeCurrent.trim().length === 0) {
    return { newText: trimmedChunk, newCursor: trimmedChunk.length };
  }

  const separator = /\n$/.test(safeCurrent) ? '' : safeCurrent.endsWith(' ') ? '' : ' ';
  const newText = `${safeCurrent}${separator}${trimmedChunk}`;
  return { newText, newCursor: newText.length };
}

/**
 * Browser Speech Recognition Provider.
 * Wraps window.SpeechRecognition / window.webkitSpeechRecognition.
 */
export class BrowserSpeechProvider implements SpeechToTextProvider {
  public readonly id = 'browser-speech-recognition';
  public readonly name = 'Browser Speech Recognition';

  private recognition: any = null;
  private state: DictationState = 'ready';
  private callbacks: SpeechToTextCallbacks | null = null;
  private activeSession = false;

  constructor(private customFactory?: () => any) {}

  public isSupported(): boolean {
    if (this.customFactory) return true;
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public getState(): DictationState {
    return this.state;
  }

  public start(callbacks: SpeechToTextCallbacks): void {
    if (this.activeSession || this.state === 'listening') {
      // Duplicate dictation protection - already listening
      return;
    }

    if (!this.isSupported()) {
      this.state = 'unavailable';
      callbacks.onStateChange('unavailable', 'Speech-to-text is not available in this browser.');
      callbacks.onError('Speech-to-text is not available in this browser.', 'unavailable');
      return;
    }

    this.callbacks = callbacks;

    try {
      const SpeechRecognitionClass =
        this.customFactory?.() ||
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        this.activeSession = true;
        this.state = 'listening';
        this.callbacks?.onStateChange('listening');
      };

      recognition.onresult = (event: any) => {
        this.state = 'processing';
        this.callbacks?.onStateChange('processing');

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0]?.transcript || '';
          if (transcript.trim().length > 0) {
            this.callbacks?.onTranscriptChunk(transcript.trim(), Boolean(result.isFinal));
          }
        }

        if (this.activeSession) {
          this.state = 'listening';
          this.callbacks?.onStateChange('listening');
        }
      };

      recognition.onerror = (event: any) => {
        const errorCode = event.error || '';
        let userMessage = 'Speech-to-text stopped unexpectedly. Your existing draft is preserved.';
        let targetState: DictationState = 'error';

        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
          userMessage = 'Microphone permission was denied. You can continue typing the report manually.';
          targetState = 'permission_denied';
        } else if (errorCode === 'network') {
          userMessage = 'Speech recognition network connection failed. Your existing draft is preserved.';
          targetState = 'error';
        } else if (errorCode === 'no-speech') {
          // Non-fatal, simply return to listening if still active
          if (this.activeSession) {
            this.state = 'listening';
            this.callbacks?.onStateChange('listening');
          }
          return;
        } else if (errorCode === 'aborted') {
          this.activeSession = false;
          this.state = 'stopped';
          this.callbacks?.onStateChange('stopped', 'Dictation stopped');
          return;
        }

        this.activeSession = false;
        this.state = targetState;
        this.callbacks?.onStateChange(targetState, userMessage);
        this.callbacks?.onError(userMessage, targetState);
      };

      recognition.onend = () => {
        this.activeSession = false;
        if (this.state === 'listening' || this.state === 'processing') {
          this.state = 'stopped';
          this.callbacks?.onStateChange('stopped', 'Dictation stopped');
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch {
      this.activeSession = false;
      this.state = 'error';
      const safeMsg = 'Speech-to-text stopped unexpectedly. Your existing draft is preserved.';
      callbacks.onStateChange('error', safeMsg);
      callbacks.onError(safeMsg, 'error');
    }
  }

  public stop(): void {
    if (this.recognition && this.activeSession) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
    }
    this.activeSession = false;
    this.state = 'stopped';
    this.callbacks?.onStateChange('stopped', 'Dictation stopped');
  }

  public abort(): void {
    if (this.recognition && this.activeSession) {
      try {
        this.recognition.abort();
      } catch {
        // Safe ignore
      }
    }
    this.activeSession = false;
    this.state = 'stopped';
    this.callbacks?.onStateChange('stopped', 'Dictation stopped');
  }
}

// Default singleton instance
export const defaultSpeechProvider = new BrowserSpeechProvider();

