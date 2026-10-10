export type CameraFacing = 'user' | 'environment';

export type ScannerFailure = 'denied' | 'unavailable';

type DecodeQr = typeof import('jsqr').default;

export interface ScannerEvents {
  onCode(text: string): void;
  onFailure(reason: ScannerFailure): void;
}

const SCAN_INTERVAL_MILLISECONDS = 120;
const MAX_FRAME_WIDTH_PX = 640;

/** Reads QR codes from the camera into `video`. Frames are taken straight from the camera, not from the mirrored
 *  preview, so a code held up to the front camera reads like any other. The camera runs only between `start` and `stop`. */
export class QrScanner {
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private readonly canvas = document.createElement('canvas');
  private running = false;
  private decode: DecodeQr | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly events: ScannerEvents,
  ) {}

  async start(facing: CameraFacing): Promise<void> {
    this.stop();
    this.running = true;
    try {
      this.decode ??= (await import('jsqr')).default;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      if (!this.running) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.timer = window.setInterval(() => this.scanFrame(), SCAN_INTERVAL_MILLISECONDS);
    } catch (error) {
      this.running = false;
      this.events.onFailure(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }

  private scanFrame(): void {
    const { video, canvas } = this;
    if (video.videoWidth === 0) return;
    const scale = Math.min(1, MAX_FRAME_WIDTH_PX / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const found = this.decode?.(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
    if (found?.data) this.events.onCode(found.data);
  }
}
