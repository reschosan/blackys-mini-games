/** Every screen the game is tested on, in CSS pixels, upright and sideways. Touch devices also get a variant with the
 *  browser bars showing (Safari on iPad and iPhone hides about 100 px of the height behind them). */
export interface ScreenSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly touch: boolean;
}

interface Device {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly touch: boolean;
  /** Also test with the browser bars showing. */
  readonly bars?: number;
  readonly uprightToo?: boolean;
}

const DEVICES: readonly Device[] = [
  { name: 'iPhone SE alt 320×568', width: 320, height: 568, touch: true },
  { name: 'Handy 360×640', width: 360, height: 640, touch: true },
  { name: 'iPhone SE 375×667', width: 375, height: 667, touch: true, bars: 80 },
  { name: 'iPhone 390×844', width: 390, height: 844, touch: true, bars: 90 },
  { name: 'Pixel 412×915', width: 412, height: 915, touch: true },
  { name: 'iPhone Max 430×932', width: 430, height: 932, touch: true, bars: 90 },
  { name: 'iPad 10" 810×1080', width: 810, height: 1080, touch: true, bars: 100 },
  { name: 'iPad 11" 820×1180', width: 820, height: 1180, touch: true, bars: 100 },
  { name: 'iPad Pro 12,9" 1024×1366', width: 1024, height: 1366, touch: true, bars: 100 },
  { name: 'Laptop 1280×720', width: 1280, height: 720, touch: false },
  { name: 'Laptop 13" 1280×800', width: 1280, height: 800, touch: false },
  { name: 'Laptop 13" 1440×900', width: 1440, height: 900, touch: false },
  { name: 'Laptop 14" 1512×982', width: 1512, height: 982, touch: false },
  { name: 'Laptop 1536×864', width: 1536, height: 864, touch: false },
  { name: 'Laptop 16" 1728×1117', width: 1728, height: 1117, touch: false },
  { name: 'Monitor 1920×1080', width: 1920, height: 1080, touch: false },
  { name: 'Monitor 2560×1440', width: 2560, height: 1440, touch: false },
  { name: 'Ultrawide 3440×1440', width: 3440, height: 1440, touch: false, uprightToo: false },
];

function sizesOf(device: Device): ScreenSize[] {
  const shorter = Math.min(device.width, device.height);
  const longer = Math.max(device.width, device.height);
  const sideways = (height: number): ScreenSize => ({ name: `${device.name} quer`, width: longer, height: Math.min(height, shorter), touch: device.touch });
  const upright = (height: number): ScreenSize => ({ name: `${device.name} hoch`, width: shorter, height, touch: device.touch });
  const sizes = [sideways(shorter)];
  if (device.uprightToo !== false) sizes.push(upright(longer));
  if (device.bars) {
    sizes.push({ ...sideways(shorter - device.bars), name: `${device.name} quer, Leiste` });
    if (device.uprightToo !== false) sizes.push({ ...upright(longer - device.bars), name: `${device.name} hoch, Leiste` });
  }
  return sizes;
}

export const ALL_SCREENS: readonly ScreenSize[] = DEVICES.flatMap(sizesOf);
export const TOUCH_SCREENS: readonly ScreenSize[] = ALL_SCREENS.filter((screen) => screen.touch);
