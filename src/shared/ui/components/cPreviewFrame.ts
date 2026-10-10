import { CHostComponent } from './base';

export type PreviewFrameSize = 'cat' | 'map';

const SIZE_CLASSES: Readonly<Record<PreviewFrameSize, string>> = {
  cat: 'h-40 bg-[#1a1a20]',
  map: 'h-48 overflow-hidden rounded-md bg-[#1a1a20]',
};

/** Frame for a live preview canvas that the game mounts into it:
 *  `<c-preview-frame size="map" data-map-preview-index="0"></c-preview-frame>`. */
export class CPreviewFrame extends CHostComponent {
  static override properties = { size: { type: String } };

  declare size: PreviewFrameSize;

  constructor() {
    super();
    this.size = 'cat';
  }

  protected override hostClasses(): string {
    return `block w-full ${SIZE_CLASSES[this.size] ?? SIZE_CLASSES.cat}`;
  }
}

customElements.define('c-preview-frame', CPreviewFrame);

declare global {
  interface HTMLElementTagNameMap {
    'c-preview-frame': CPreviewFrame;
  }
}
