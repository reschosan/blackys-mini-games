import type { Page } from '@playwright/test';

export type FindingKind =
  'overlap' | 'clipped' | 'unreachable' | 'tiny-target' | 'tiny-text' | 'contrast' | 'nested-scroll' | 'sideways-overflow' | 'page-overflow';

export interface Finding {
  readonly kind: FindingKind;
  readonly detail: string;
}

export interface AuditOptions {
  /** Touch screens need 44 px targets, mouse screens 24 px (WCAG 2.2). */
  readonly touch: boolean;
  /** CSS selectors of elements that may overlap their surroundings by design (e.g. a label on a preview picture). */
  readonly allowOverlap?: readonly string[];
}

/** Looks at the page like a careful person would and reports what is wrong with the layout: things that cover each other,
 *  text that is cut off, content that cannot be reached, targets too small to hit, text too small or too faint to read.
 *  Runs in the browser, on whatever the page shows right now. */
export async function auditLayout(page: Page, options: AuditOptions): Promise<Finding[]> {
  return page.evaluate((opts) => {
    type Kind = 'overlap' | 'clipped' | 'unreachable' | 'tiny-target' | 'tiny-text' | 'contrast' | 'nested-scroll' | 'sideways-overflow' | 'page-overflow';
    interface Box {
      el: Element;
      left: number;
      top: number;
      right: number;
      bottom: number;
      text: string;
      kind: 'text' | 'media' | 'control';
    }
    const findings: { kind: Kind; detail: string }[] = [];
    const report = (kind: Kind, detail: string): void => {
      findings.push({ kind, detail });
    };

    const style = document.createElement('style');
    style.textContent = '* { pointer-events: auto !important; }';
    document.head.appendChild(style);

    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const classes =
        typeof el.className === 'string'
          ? el.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((name) => `.${name}`)
              .join('')
          : '';
      return `${el.localName}${id}${classes}`;
    };
    const visible = (el: Element): boolean => (el as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const isSkipped = (el: Element): boolean => el.closest('[aria-hidden="true"], #game-canvas, script, style') !== null;

    // Elements that only look hidden by position (fully scrolled away) still count for reachability, so no further filtering here.
    const boxes: Box[] = [];
    const addBox = (
      el: Element,
      rect: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number },
      text: string,
      kind: Box['kind'],
    ): void => {
      if (rect.width < 1 || rect.height < 1) return;
      boxes.push({ el, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, text, kind });
    };

    for (const el of document.body.querySelectorAll('*')) {
      if (isSkipped(el) || !visible(el)) continue;
      if (el.closest('svg') && el.localName !== 'svg') continue;
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) addBox(el, rect, node.textContent.trim().slice(0, 40), 'text');
      }
      const tag = el.localName;
      if (tag === 'img' || tag === 'svg' || tag === 'canvas') addBox(el, el.getBoundingClientRect(), tag, 'media');
      if (['button', 'input', 'select', 'textarea'].includes(tag) && (el as HTMLInputElement).type !== 'hidden') {
        addBox(el, el.getBoundingClientRect(), (el.textContent ?? (el as HTMLInputElement).value ?? tag).trim().slice(0, 40) || tag, 'control');
      }
    }

    const scrollable = (el: Element, axis: 'x' | 'y'): boolean => {
      const computed = getComputedStyle(el);
      const overflow = axis === 'y' ? computed.overflowY : computed.overflowX;
      const room = axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
      return (overflow === 'auto' || overflow === 'scroll') && room;
    };
    const reachableByScrolling = (el: Element, axis: 'x' | 'y'): boolean => {
      if (getComputedStyle(el).position === 'fixed') return false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).position === 'fixed' && parent !== el) return scrollable(parent, axis);
        if (scrollable(parent, axis)) return true;
      }
      return (
        document.scrollingElement !== null &&
        (axis === 'y' ? document.scrollingElement.scrollHeight > viewportHeight + 1 : document.scrollingElement.scrollWidth > viewportWidth + 1) &&
        getComputedStyle(document.documentElement).overflow !== 'hidden' &&
        getComputedStyle(document.body).overflow !== 'hidden'
      );
    };

    // 1. Content outside the window that no scrolling can bring in, and content cut off by a parent.
    const onScreen: Box[] = [];
    for (const box of boxes) {
      const outsideX = box.left < -1 || box.right > viewportWidth + 1;
      const outsideY = box.top < -1 || box.bottom > viewportHeight + 1;
      if ((outsideX && !reachableByScrolling(box.el, 'x')) || (outsideY && !reachableByScrolling(box.el, 'y'))) {
        report(
          'unreachable',
          `${describe(box.el)} „${box.text}“ liegt außerhalb (${Math.round(box.left)},${Math.round(box.top)} bis ${Math.round(box.right)},${Math.round(box.bottom)})`,
        );
        continue;
      }
      let clippedBy: Element | null = null;
      for (let parent = box.el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const computed = getComputedStyle(parent);
        const clips = computed.overflowX === 'hidden' || computed.overflowX === 'clip' || computed.overflowY === 'hidden' || computed.overflowY === 'clip';
        if (!clips || parent === document.documentElement) continue;
        const bounds = parent.getBoundingClientRect();
        const cutX = (computed.overflowX === 'hidden' || computed.overflowX === 'clip') && (box.left < bounds.left - 1.5 || box.right > bounds.right + 1.5);
        const cutY = (computed.overflowY === 'hidden' || computed.overflowY === 'clip') && (box.top < bounds.top - 1.5 || box.bottom > bounds.bottom + 1.5);
        if (cutX || cutY) {
          clippedBy = parent;
          break;
        }
      }
      if (clippedBy) {
        report('clipped', `${describe(box.el)} „${box.text}“ wird von ${describe(clippedBy)} abgeschnitten`);
        continue;
      }
      if (!outsideX && !outsideY) onScreen.push(box);
    }

    // 2. Things that cover each other. A box counts only with the part its scrolling or clipping parents let through, and only
    //    what is really on top at its own centre (the lobby behind an opaque menu does not).
    const clipToParents = (box: Box): Box | null => {
      let { left, top, right, bottom } = box;
      for (let parent = box.el.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
        const computed = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (computed.overflowX !== 'visible') {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (computed.overflowY !== 'visible') {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
      }
      return right - left < 1 || bottom - top < 1 ? null : { ...box, left, top, right, bottom };
    };
    const reallyShown = onScreen
      .map(clipToParents)
      .filter((box): box is Box => box !== null)
      .filter((box) => {
        const x = Math.min(Math.max((box.left + box.right) / 2, 0), viewportWidth - 1);
        const y = Math.min(Math.max((box.top + box.bottom) / 2, 0), viewportHeight - 1);
        const top = document.elementFromPoint(x, y);
        return top !== null && (box.el.contains(top) || top.contains(box.el));
      });
    const allowed = (el: Element): boolean => (opts.allowOverlap ?? []).some((selector) => el.closest(selector) !== null);
    const seen = new Set<string>();
    for (let first = 0; first < reallyShown.length; first += 1) {
      for (let second = first + 1; second < reallyShown.length; second += 1) {
        const a = reallyShown[first]!;
        const b = reallyShown[second]!;
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || allowed(a.el) || allowed(b.el)) continue;
        // The frame rate readout is a fixed chip in a corner; content that scrolls may pass under it (it has clearance at the end of the scroll).
        const readout = a.el.closest('c-perf-readout') ? a : b.el.closest('c-perf-readout') ? b : null;
        const other = readout === a ? b : a;
        if (
          readout &&
          (() => {
            for (let parent: Element | null = other.el; parent; parent = parent.parentElement) if (scrollable(parent, 'y')) return true;
            return false;
          })()
        )
          continue;
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width <= 2 || height <= 2) continue;
        const smaller = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top));
        if ((width * height) / smaller < 0.12) continue;
        const key = `${describe(a.el)}|${describe(b.el)}|${a.text}|${b.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        report('overlap', `${describe(a.el)} „${a.text}“ überdeckt ${describe(b.el)} „${b.text}“ (${Math.round(width)}×${Math.round(height)} px)`);
      }
    }

    // 3. Targets too small to hit.
    const minimumTarget = opts.touch ? 44 : 24;
    const controls = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="radio"]');
    for (const el of controls) {
      if (isSkipped(el) || !visible(el) || (el as HTMLInputElement).type === 'hidden') continue;
      if (el.closest('[disabled], [aria-disabled="true"]') && (el as HTMLButtonElement).disabled) continue;
      // A link inside a sentence is exempt from the minimum size (WCAG 2.2, target size, "inline" exception).
      if (el.localName === 'a' && getComputedStyle(el).display === 'inline') continue;
      const target = el.closest('label') ?? el;
      const rect = target.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (Math.min(rect.width, rect.height) < minimumTarget - 0.5) {
        report(
          'tiny-target',
          `${describe(el)} „${(el.textContent ?? '').trim().slice(0, 30)}“ ist ${Math.round(rect.width)}×${Math.round(rect.height)} px (mindestens ${minimumTarget})`,
        );
      }
    }

    // 4. Text too small, and text too faint.
    /** Any CSS colour (rgb, oklch, color-mix …) as red, green, blue, alpha: the browser's own canvas converts it. */
    const colourCanvas = document.createElement('canvas');
    colourCanvas.width = colourCanvas.height = 1;
    const colourContext = colourCanvas.getContext('2d', { willReadFrequently: true })!;
    const parse = (color: string): [number, number, number, number] => {
      colourContext.clearRect(0, 0, 1, 1);
      colourContext.fillStyle = '#000';
      colourContext.fillStyle = color;
      colourContext.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = colourContext.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0, (a ?? 0) / 255];
    };
    const over = (fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] =>
      [0, 1, 2].map((index) => fg[index]! * fg[3] + bg[index]! * (1 - fg[3])) as [number, number, number];
    const luminance = (rgb: [number, number, number]): number => {
      const [r, g, b] = rgb.map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: [number, number, number], b: [number, number, number]): number => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (light + 0.05) / (dark + 0.05);
    };
    /** The faintest contrast the text can have: layers that are not opaque are checked over both black and white. */
    const worstContrast = (el: Element): number => {
      const layers: [number, number, number, number][] = [];
      let opaque = false;
      for (let node: Element | null = el; node; node = node.parentElement) {
        const background = parse(getComputedStyle(node).backgroundColor);
        if (background[3] > 0) layers.push(background);
        if (background[3] >= 1) {
          opaque = true;
          break;
        }
      }
      const text = parse(getComputedStyle(el).color);
      const grounds: [number, number, number][] = opaque
        ? [[16, 16, 20]]
        : [
            [0, 0, 0],
            [255, 255, 255],
          ];
      return Math.min(
        ...grounds.map((ground) => {
          let composed = ground;
          for (const layer of [...layers].reverse()) composed = over(layer, composed);
          return ratio(over(text, composed), composed);
        }),
      );
    };
    const checkedText = new Set<Element>();
    for (const box of boxes) {
      if (box.kind !== 'text' || checkedText.has(box.el)) continue;
      checkedText.add(box.el);
      if (box.el.closest('[disabled], [aria-disabled="true"]')) continue;
      const computed = getComputedStyle(box.el);
      const size = parseFloat(computed.fontSize);
      if (size < 0.95 * rootFont - 0.5)
        report('tiny-text', `${describe(box.el)} „${box.text}“ ist ${size.toFixed(1)} px groß (unter 0,95 rem = ${(0.95 * rootFont).toFixed(1)} px)`);
      const large = size >= 24 || (size >= 18.66 && parseInt(computed.fontWeight, 10) >= 700);
      const needed = large ? 3 : 4.5;
      const contrast = worstContrast(box.el);
      if (contrast < needed) report('contrast', `${describe(box.el)} „${box.text}“ hat Kontrast ${contrast.toFixed(1)}:1 (nötig ${needed}:1)`);
    }

    // 5. A scroll area inside a scroll area cuts content off with no sign that it scrolls (one scroll area per screen).
    for (const el of document.body.querySelectorAll('*')) {
      if (isSkipped(el) || !visible(el) || !scrollable(el, 'y')) continue;
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (scrollable(parent, 'y')) {
          report('nested-scroll', `${describe(el)} scrollt innerhalb von ${describe(parent)}`);
          break;
        }
      }
    }

    // 6. Content that sticks out sideways: nobody scrolls sideways on a game screen, so it is cut off for everyone.
    for (const el of document.body.querySelectorAll('*')) {
      if (isSkipped(el) || !visible(el) || el === document.body || el.clientWidth <= 1) continue;
      const overflowX = getComputedStyle(el).overflowX;
      const clipsOrScrolls = overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden' || overflowX === 'clip';
      if (clipsOrScrolls && el.scrollWidth > el.clientWidth + 1)
        report('sideways-overflow', `${describe(el)} ist innen ${el.scrollWidth} px breit bei ${el.clientWidth} px Platz`);
    }

    // 7. The page itself.
    const scrolling = document.scrollingElement;
    if (scrolling && scrolling.scrollWidth > viewportWidth + 1 && getComputedStyle(document.body).overflowX !== 'hidden') {
      report('page-overflow', `Seite ist ${scrolling.scrollWidth} px breit bei ${viewportWidth} px Fenster`);
    }

    style.remove();
    return findings;
  }, options);
}

/** One line per finding, grouped, for the test report. */
export function formatFindings(findings: readonly Finding[]): string {
  return findings.map((finding) => `  [${finding.kind}] ${finding.detail}`).join('\n');
}
