import { createAiDriverState } from '../../games/kart/ai/aiDriver';
import { CAT_PRESETS, createCatAppearance, type CatPreset } from '../../shared/config/catAppearance';
import { firstFreeCatName } from '../../shared/config/catNames';
import { createKartLoadout, randomKartLoadout } from '../../shared/config/kartLoadout';
import { MAX_PLAYERS, PLAYER_APPEARANCES } from '../../shared/config/players';
import type { Rng } from '../../shared/core/rng';
import type { InputManager } from '../../shared/input/inputManager';
import { createKartState } from '../../games/kart/kart/kartState';
import type { RacePlayer } from '../../games/kart/race/racePlayer';
import type { RacePresentation } from '../../games/kart/race/views/racePresentation';
import { createProgress } from '../../games/kart/race/raceState';
import type { MapConfig } from '../../games/kart/maps/shared/mapConfig';
import type { AiWizard } from '../lobby/aiWizard';
import type { LobbyCustomization } from '../lobby/catCustomization';

export interface RosterDependencies {
  readonly input: InputManager;
  readonly customization: LobbyCustomization;
  readonly aiWizard: AiWizard;
  readonly presentation: RacePresentation;
  readonly rng: Rng;
  readonly currentMap: () => MapConfig;
}

/** The karts of the current lobby/race: joined humans first, then AI fill. Owns creating and
 *  removing racers (and their views) and keeps AI cats visually distinct from the humans'. */
export class PlayerRoster {
  readonly players: RacePlayer[] = [];
  private aiCount = 0;
  private aiCountBeforeFill: number | null = null;

  constructor(private readonly deps: RosterDependencies) {}

  /** Adds or removes karts so humans and AI fill match the lobby. */
  syncWithLobby(): void {
    const { input, customization } = this.deps;
    customization.syncPlayers(input.players);
    const staleAiIndex = this.players.findIndex((player, index) => player.isAi && index < input.players.length);
    if (staleAiIndex !== -1) this.removeFrom(staleAiIndex);
    while (this.players.length < input.players.length) {
      if (!this.addKart(false)) return;
    }
    while (this.players.length < input.players.length + this.aiCount) {
      if (!this.addKart(true)) return;
    }
  }

  /** A game that needs more cats than there are players (a fight with nobody to fight): AI cats fill the seats up for this game. */
  fillUpTo(totalSeats: number): void {
    const missing = totalSeats - this.players.length;
    if (missing <= 0) return;
    this.aiCountBeforeFill ??= this.aiCount;
    this.setAiCount(this.aiCount + missing);
    this.syncWithLobby();
  }

  /** The game is over: the AI cats it added go again, the lobby has the number of AI opponents the players chose. */
  releaseFill(): void {
    if (this.aiCountBeforeFill === null) return;
    this.setAiCount(this.aiCountBeforeFill);
    this.aiCountBeforeFill = null;
    this.removeFrom(this.deps.input.players.length + this.aiCount);
    this.syncWithLobby();
  }

  /** "Fill slots with AI", triggered by Pause in the lobby: cycles the AI kart count one at a
   *  time (0 -> 1 -> ... up to the free slots -> back to 0). A fixed count, not re-balanced if
   *  more humans join afterwards. */
  cycleAiFill(): void {
    const { input } = this.deps;
    const maxAi = Math.max(this.deps.currentMap().startPositions.length - input.players.length, 0);
    if (maxAi === 0) {
      this.setAiCount(0);
      return;
    }
    this.setAiCount((this.aiCount + 1) % (maxAi + 1));
    const desiredTotal = input.players.length + this.aiCount;
    if (this.players.length > desiredTotal) this.removeFrom(desiredTotal);
    this.syncWithLobby();
  }

  /** Debug convenience for adding a single AI kart without the Pause fill-cycle. */
  addDebugAiKart(): void {
    if (this.players.length >= this.deps.currentMap().startPositions.length) return;
    this.setAiCount(this.aiCount + 1);
    this.syncWithLobby();
  }

  /** Dev-only endurance races: every slot beyond the humans is an AI kart. */
  fillWithAi(): void {
    this.setAiCount(MAX_PLAYERS);
    if (this.players.length > MAX_PLAYERS) this.removeFrom(MAX_PLAYERS);
    this.syncWithLobby();
  }

  /** Applies lobby customization and AI difficulty to the racers' cats. */
  syncAppearance(): void {
    const { input, customization, aiWizard, presentation } = this.deps;
    this.players.forEach((player, index) => {
      const joinedPlayer = input.players[index];
      const entry = joinedPlayer ? customization.entryFor(joinedPlayer) : undefined;
      if (entry) {
        presentation.setAppearance(player, entry.appearance);
        player.loadout = entry.loadout;
        presentation.setLoadout(player, entry.loadout);
      }
      if (player.isAi) player.difficulty = aiWizard.difficultyFor(index - input.players.length);
    });
    this.reassignConflictingAiFurColors();
  }

  /** Back to an empty lobby. */
  clear(): void {
    this.removeFrom(0);
    this.aiCount = 0;
  }

  removeFrom(index: number): void {
    for (const player of this.players.slice(index)) this.deps.presentation.removeRacer(player);
    this.players.length = index;
  }

  private setAiCount(count: number): void {
    this.aiCount = count;
    this.deps.aiWizard.syncCount(count);
  }

  private addKart(isAi: boolean): boolean {
    const { input, customization, aiWizard, presentation } = this.deps;
    const index = this.players.length;
    const start = this.deps.currentMap().startPositions[index];
    const appearance = PLAYER_APPEARANCES[index];
    const joinedPlayer = input.players[index];
    if (!start || !appearance || (!isAi && !joinedPlayer)) return false;
    const catAppearance = isAi
      ? createCatAppearance(this.pickAiPreset(), this.freeCatName())
      : (customization.entryFor(joinedPlayer!)?.appearance ?? createCatAppearance());
    const player: RacePlayer = {
      state: createKartState(start.x, start.z, start.yaw, start.levelId),
      progress: createProgress(start.x, start.z, start.levelId),
      isAi,
      aiDriver: isAi ? createAiDriverState(index) : null,
      loadout: isAi ? randomKartLoadout(this.deps.rng, index) : (customization.entryFor(joinedPlayer!)?.loadout ?? createKartLoadout(index)),
      difficulty: isAi ? aiWizard.difficultyFor(index - input.players.length) : null,
      heldItem: null,
      previousUseItem: false,
      raceStartEarlyPress: false,
      raceStartBoostEarned: false,
    };
    this.players.push(player);
    presentation.addRacer(player, appearance.bodyColor, catAppearance, player.loadout);
    return true;
  }

  /** A cat name nobody in this lobby has (humans and AI cats): AI cats are called like the cats of the players, not "Katze 3". */
  private freeCatName(): string {
    const { input, customization, presentation } = this.deps;
    const taken = new Set([
      ...this.players.map((player) => presentation.appearanceFor(player).name),
      ...input.players.map((joined) => customization.entryFor(joined)?.appearance.name ?? ''),
    ]);
    return firstFreeCatName(taken);
  }

  /** Random cat preset for a new AI kart, avoiding a fur color already used by any kart in this
   *  lobby, unless every color is already taken. Seeded RNG: gameplay-affecting randomness. */
  private pickAiPreset(): CatPreset {
    const { presentation, rng } = this.deps;
    const usedFurColors = new Set(this.players.map((player) => presentation.appearanceFor(player).furColor));
    const available = CAT_PRESETS.filter((preset) => !usedFurColors.has(preset.furColor));
    const pool = available.length > 0 ? available : CAT_PRESETS;
    return pool[rng.nextInt(pool.length)] ?? pool[0]!;
  }

  /** A human freely picking a fur color always wins: an AI kart with the same color moves to a
   *  different, still-free color, never the other way round. */
  private reassignConflictingAiFurColors(): void {
    const { presentation } = this.deps;
    for (const player of this.players) {
      if (!player.isAi) continue;
      const furColor = presentation.appearanceFor(player).furColor;
      const look = presentation.appearanceFor(player);
      const conflict = this.players.some((other) => other !== player && presentation.appearanceFor(other).furColor === furColor);
      const nameTaken = this.players.some((other) => other !== player && !other.isAi && presentation.appearanceFor(other).name === look.name);
      if (conflict) presentation.setAppearance(player, createCatAppearance(this.pickAiPreset(), look.name));
      if (nameTaken) presentation.setAppearance(player, { ...presentation.appearanceFor(player), name: this.freeCatName() });
    }
  }
}
