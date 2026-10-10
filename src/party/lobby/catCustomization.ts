import {
  CAT_PRESETS,
  EYE_COLORS,
  FUR_COLORS,
  HAIR_LENGTHS,
  MANE_STYLES,
  CAT_PATTERNS,
  createCatAppearance,
  patternUsesSecondaryColor,
  type CatAppearance,
} from '../../shared/config/catAppearance';
import { KART_TYPES, WHEEL_TYPES, createKartLoadout, hasWheelChoice, normalizeKartLoadout, type KartLoadout } from '../../shared/config/kartLoadout';
import type { PreviewSubject } from '../../games/kart/kart/views/catPreview';
import { DEFAULT_MEMORY_LEVEL, MEMORY_LEVELS } from '../../shared/config/memoryLevels';
import { DEFAULT_PLANE_TYPE, PLANE_TYPES, type PlaneTypeId } from '../../shared/config/planeTypes';
import type { InputFrame } from '../../shared/input/actions';
import { playerSourceKey, type JoinedPlayer } from '../../shared/input/inputManager';
import { catNameId, firstFreeCatName, isCatNameId, nextFreeCatName } from '../../shared/config/catNames';
import { loadCatAppearance, loadKartLoadout, loadPlaneType, saveCatAppearance, saveKartLoadout, savePlaneType } from './catPersistence';
import { PlayerLobbyInput, type LobbyCommand } from './playerLobbyInput';

export type CustomizationRow =
  | 'preset'
  | 'name'
  | 'furColor'
  | 'pattern'
  | 'secondaryColor'
  | 'hairLength'
  | 'mane'
  | 'eyeColor'
  | 'kartType'
  | 'wheels'
  | 'kartColor'
  | 'planeType'
  | 'memoryLevel'
  | 'ready'
  | 'leave';

/** What the card edits: the preset of the cat first, then what the chosen game needs. */
export type LobbyPage = 'start' | 'cat' | 'kart' | 'plane' | 'memory';

export interface CustomizationEntry {
  appearance: CatAppearance;
  loadout: KartLoadout;
  plane: PlaneTypeId;
  /** The level of memory (an index in `MEMORY_LEVELS`): the same for every player, whoever changes it. */
  level: number;
  page: LobbyPage;
  presetIndex: number;
  ready: boolean;
  selectedRow: number;
}

const FIRST_ROW_OF_PAGE: Readonly<Record<LobbyPage, CustomizationRow>> = {
  start: 'preset',
  cat: 'preset',
  kart: 'kartType',
  plane: 'planeType',
  memory: 'memoryLevel',
};

/** What the card shows: before the vote only the preset of the cat; after the vote what the chosen game needs: the whole cat (and the kart), the plane alone, or the level of memory alone. */
export function rowsFor(entry: Pick<CustomizationEntry, 'appearance' | 'loadout' | 'page'>): readonly CustomizationRow[] {
  if (entry.page === 'start') return ['preset', 'ready', 'leave'];
  if (entry.page === 'plane') return ['planeType', 'ready', 'leave'];
  if (entry.page === 'memory') return ['memoryLevel', 'ready', 'leave'];
  const rows: CustomizationRow[] = ['name', 'preset', 'furColor', 'pattern'];
  if (patternUsesSecondaryColor(entry.appearance.pattern)) rows.push('secondaryColor');
  rows.push('hairLength', 'mane', 'eyeColor');
  if (entry.page === 'kart') rows.push('kartType');
  if (entry.page === 'kart' && hasWheelChoice(entry.loadout)) rows.push('wheels');
  if (entry.page === 'kart') rows.push('kartColor');
  rows.push('ready', 'leave');
  return rows;
}

function hasValue(row: CustomizationRow): boolean {
  return row !== 'ready' && row !== 'leave';
}

function cycle<T>(items: readonly T[], current: T, delta: number): T {
  const index = items.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return items[(safeIndex + delta + items.length) % items.length]!;
}

function changeLoadout(loadout: KartLoadout, row: 'kartType' | 'wheels' | 'kartColor', delta: number): KartLoadout {
  if (row === 'kartType') return normalizeKartLoadout({ ...loadout, kartType: cycle(KART_TYPES, loadout.kartType, delta) });
  if (row === 'wheels') return { ...loadout, wheels: cycle(WHEEL_TYPES, loadout.wheels, delta) };
  return normalizeKartLoadout({ ...loadout, colorIndex: loadout.colorIndex + delta });
}

function saveEntry(key: string, entry: CustomizationEntry): void {
  saveCatAppearance(key, entry.appearance);
  saveKartLoadout(key, entry.loadout);
  savePlaneType(key, entry.plane);
}

/**
 * Drives the lobby's per-player cat customization: one row/value cursor and ready flag per
 * joined player, each controlled only by that player's own input, persisted per device.
 */
export class LobbyCustomization {
  private readonly entries = new Map<string, CustomizationEntry>();
  private sharedLevel = DEFAULT_MEMORY_LEVEL;
  private readonly inputs = new Map<string, PlayerLobbyInput>();

  /** Adds entries for newly joined players (loading saved appearance) and drops left ones. */
  syncPlayers(joined: readonly JoinedPlayer[]): void {
    const keys = new Set(joined.map((player) => playerSourceKey(player.source)));
    for (const key of [...this.entries.keys()]) {
      if (!keys.has(key)) {
        this.entries.delete(key);
        this.inputs.delete(key);
      }
    }
    joined.forEach((player, index) => {
      const key = playerSourceKey(player.source);
      if (this.entries.has(key)) return;
      const saved = loadCatAppearance(key) ?? createCatAppearance(CAT_PRESETS[0]);
      this.entries.set(key, {
        appearance: { ...saved, name: this.nameForNewPlayer(saved.name) },
        loadout: loadKartLoadout(key) ?? createKartLoadout(index),
        plane: loadPlaneType(key) ?? DEFAULT_PLANE_TYPE,
        level: this.sharedLevel,
        page: 'start',
        presetIndex: 0,
        ready: false,
        selectedRow: 0,
      });
      this.inputs.set(key, new PlayerLobbyInput());
    });
  }

  /** The saved name if it is a valid cat name nobody else has; otherwise the first free one. */
  private nameForNewPlayer(savedName: string): string {
    const taken = this.namesTakenBy(undefined);
    const name = catNameId(savedName);
    return isCatNameId(name) && !taken.has(name) ? name : firstFreeCatName(taken);
  }

  private namesTakenBy(except: CustomizationEntry | undefined): Set<string> {
    return new Set([...this.entries.values()].filter((other) => other !== except).map((other) => other.appearance.name));
  }

  reset(): void {
    this.entries.clear();
    this.inputs.clear();
  }

  entryFor(player: JoinedPlayer): CustomizationEntry | undefined {
    return this.entries.get(playerSourceKey(player.source));
  }

  /** The cat and kart a guest phone has saved: the player takes them over. The name stays the host's, because names are given out once
   *  (the guest's saved one is only kept if it is a cat name nobody has). */
  applyProfile(player: JoinedPlayer, appearance: CatAppearance, loadout: KartLoadout): void {
    const entry = this.entryFor(player);
    if (!entry) return;
    const taken = this.namesTakenBy(entry);
    const offered = catNameId(appearance.name);
    const name = isCatNameId(offered) && !taken.has(offered) ? offered : entry.appearance.name;
    entry.appearance = { ...appearance, name };
    entry.loadout = normalizeKartLoadout(loadout);
    saveEntry(playerSourceKey(player.source), entry);
  }

  /** The plane a player flies: the chosen one, or one by seat for AI. */
  planeOf(player: JoinedPlayer | undefined, slot: number): PlaneTypeId {
    return (player && this.entryFor(player)?.plane) || PLANE_TYPES[slot % PLANE_TYPES.length]!;
  }

  /** The level of memory the players chose. */
  memoryLevel(): number {
    return this.sharedLevel;
  }

  pageOf(player: JoinedPlayer): LobbyPage {
    return this.entryFor(player)?.page ?? 'start';
  }

  /** Everybody edits `page` now (the kart or the plane of the game that was chosen, or the cat again) and is not ready any more. */
  showPage(joined: readonly JoinedPlayer[], page: LobbyPage): void {
    for (const player of joined) {
      const entry = this.entryFor(player);
      if (!entry) continue;
      entry.page = page;
      entry.ready = false;
      entry.selectedRow = Math.max(rowsFor(entry).indexOf(FIRST_ROW_OF_PAGE[page]), 0);
    }
    this.holdInputsUntilRelease();
  }

  /** Used by the AI wizard to send player 1 back to their own customization on "Back". */
  setReady(player: JoinedPlayer, ready: boolean): void {
    const entry = this.entryFor(player);
    if (!entry) return;
    entry.ready = ready;
  }

  /** After returning from another screen: presses still held from there must not count here. */
  holdInputsUntilRelease(): void {
    for (const input of this.inputs.values()) input.holdUntilRelease();
  }

  allReady(joined: readonly JoinedPlayer[]): boolean {
    return joined.length > 0 && joined.every((player) => this.entryFor(player)?.ready === true);
  }

  /** Mouse equivalent of navigating to a row (clicking it directly instead of steering there).
   *  Clicking the "ready" button row also immediately toggles it, same as pressing confirm there
   *  would — it has no separate arrows/value to interact with first. */
  selectRow(player: JoinedPlayer, rowIndex: number): void {
    const entry = this.entryFor(player);
    if (!entry) return;
    const rows = rowsFor(entry);
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    entry.selectedRow = rowIndex;
    if (rows[rowIndex] === 'ready') entry.ready = !entry.ready;
  }

  /** Mouse equivalent of a value-change edge on the currently selected row (clicking a ◀/▶ arrow
   *  instead of steering). */
  changeValue(player: JoinedPlayer, delta: -1 | 1): void {
    const entry = this.entryFor(player);
    if (!entry) return;
    const rows = rowsFor(entry);
    const currentRow = rows[Math.min(entry.selectedRow, rows.length - 1)]!;

    if (!hasValue(currentRow)) return;
    this.applyValueChange(entry, currentRow, delta);
    saveEntry(playerSourceKey(player.source), entry);
  }

  /**
   * Applies each player's own frame to their row/value selection and ready state and persists changed appearances per device. `onAction`,
   * if given, is called for row/value navigation and for an actually-applied confirm/ready-toggle
   * — purely so the caller can play a matching menu sound; never affects state here. Returns the
   * players who confirmed the "Leave" row; the caller removes them after this update.
   */
  update(joined: readonly JoinedPlayer[], frames: readonly InputFrame[], onAction?: (kind: 'navigate' | 'confirm') => void): readonly JoinedPlayer[] {
    return joined.filter((player, index) => this.updatePlayer(player, frames[index], onAction));
  }

  private updatePlayer(player: JoinedPlayer, frame: InputFrame | undefined, onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    const key = playerSourceKey(player.source);
    const entry = this.entries.get(key);
    const input = this.inputs.get(key);
    if (!entry || !input || !frame) return false;

    const command = input.read(frame);
    const rows = rowsFor(entry);
    if (command.rowDelta !== 0) {
      entry.selectedRow = (entry.selectedRow + command.rowDelta + rows.length) % rows.length;
      onAction?.('navigate');
    }
    const currentRow = rows[Math.min(entry.selectedRow, rows.length - 1)]!;

    if (command.confirm && currentRow === 'leave') {
      onAction?.('confirm');
      return true;
    }
    if (this.applyConfirmOrValueChange(entry, currentRow, command, onAction)) saveEntry(key, entry);
    return false;
  }

  private applyConfirmOrValueChange(
    entry: CustomizationEntry,
    currentRow: CustomizationRow,
    command: LobbyCommand,
    onAction?: (kind: 'navigate' | 'confirm') => void,
  ): boolean {
    if (command.confirm) {
      entry.ready = !entry.ready;
      onAction?.('confirm');
      return false;
    }
    if (!hasValue(currentRow) || command.valueDelta === 0) return false;
    this.applyValueChange(entry, currentRow, command.valueDelta);
    onAction?.('navigate');
    return true;
  }

  private applyValueChange(entry: CustomizationEntry, row: CustomizationRow, delta: number): void {
    if (row === 'memoryLevel') {
      this.sharedLevel = (this.sharedLevel + delta + MEMORY_LEVELS.length) % MEMORY_LEVELS.length;
      for (const other of this.entries.values()) other.level = this.sharedLevel;
      return;
    }
    if (row === 'planeType') {
      entry.plane = cycle(PLANE_TYPES, entry.plane, delta);
      return;
    }
    if (row === 'kartType' || row === 'wheels' || row === 'kartColor') {
      entry.loadout = changeLoadout(entry.loadout, row, delta);
      return;
    }
    entry.appearance = this.changeAppearance(entry, row, delta);
  }

  private changeAppearance(entry: CustomizationEntry, row: CustomizationRow, delta: number): CatAppearance {
    if (row === 'name') {
      return { ...entry.appearance, name: nextFreeCatName(entry.appearance.name, delta, this.namesTakenBy(entry)) };
    }
    if (row === 'preset') {
      entry.presetIndex = (entry.presetIndex + delta + CAT_PRESETS.length) % CAT_PRESETS.length;
      return createCatAppearance(CAT_PRESETS[entry.presetIndex], entry.appearance.name);
    }
    if (row === 'furColor') {
      return { ...entry.appearance, furColor: cycle(FUR_COLORS, entry.appearance.furColor, delta) };
    }
    if (row === 'pattern') {
      return { ...entry.appearance, pattern: cycle(CAT_PATTERNS, entry.appearance.pattern, delta) };
    }
    if (row === 'secondaryColor') {
      return {
        ...entry.appearance,
        patternSecondaryColor: cycle(FUR_COLORS, entry.appearance.patternSecondaryColor, delta),
      };
    }
    if (row === 'hairLength') {
      return { ...entry.appearance, hairLength: cycle(HAIR_LENGTHS, entry.appearance.hairLength, delta) };
    }
    if (row === 'mane') {
      return { ...entry.appearance, mane: cycle(MANE_STYLES, entry.appearance.mane, delta) };
    }
    return { ...entry.appearance, eyeColor: cycle(EYE_COLORS, entry.appearance.eyeColor, delta) };
  }
}

/** What the preview of a card shows on its page: the kart only on the page of a kart game, the plane on the plane page, otherwise the cat alone. */
export function previewSubjectOf(entry: Pick<CustomizationEntry, 'page' | 'plane'>): PreviewSubject {
  if (entry.page === 'kart') return { kind: 'kart' };
  return entry.page === 'plane' ? { kind: 'plane', plane: entry.plane } : { kind: 'cat' };
}
