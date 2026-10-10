import { speedOf } from '../../../games/kart/kart/kartState';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { routeDrivingHint } from '../../../games/kart/maps/shared/routeGuidance';
import { kartElevationAt } from '../../../games/kart/maps/shared/surface';
import { windowJumpHeight, windowJumpHint } from '../../../games/kart/maps/shared/windowJumps';
import type { EngineSnapshot, RoundInfo } from '../../../shared/game/engine';
import type { ModeRules } from '../../../games/kart/modes/rules/modeRules';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../../games/kart/race/raceWorld';
import type { RuntimeMetricsSnapshot } from '../../../shared/debug/runtimeMetrics';
import type { GameParts } from './gameParts';

/** `window.__game.getState()`: what the browser tests and agents read instead of pixels. `runtime` and `enduranceMode` are kept by `Game`. */
export function gameStateOf(parts: GameParts, loop: { readonly runtime: RuntimeMetricsSnapshot; readonly enduranceMode: boolean }) {
  const { flow, input, remote, session, configs, presentation, players, world, lifecycle, engines } = parts;
  const { map } = lifecycle;
  return {
    phase: flow.phase,
    seed: parts.sessionSeed,
    touchPlayer: input.hasTouchPlayer(),
    playerSources: input.players.map((player) => player.source.kind),
    guests: input.remoteInputs.map((guest) => ({ id: guest.id, connected: guest.connected, latencyMilliseconds: guest.latencyMilliseconds })),
    invite: remote.host.state,
    raceNumber: session.number,
    graphicsQuality: configs.graphics.quality,
    emergencyGraphics: configs.graphics.emergency,
    mapName: map.name,
    mapReady: presentation.isMapReady(),
    playerCount: players.length,
    lapCount: configs.race.lapCount,
    raceTimeSeconds: world.raceTimeSeconds,
    finishCountdownSeconds: session.remainingFinishSeconds(),
    karts: kartReports(map, players, world.places),
    ...worldItemReport(world),
    runtime: loop.runtime,
    ...presentation.diagnostics(),
    enduranceMode: loop.enduranceMode,
    ...roundReport(lifecycle.gameId, lifecycle.info(), session.rules, players.length, engines.round?.snapshot() ?? null),
  };
}

/** The kart part of `window.__game.getState()`: plain numbers and strings for tests and agents. */
function kartReports(map: MapConfig, players: readonly RacePlayer[], places: readonly number[]) {
  return players.map((player, index) => ({
    x: player.state.x,
    z: player.state.z,
    levelId: player.state.levelId,
    elevation: kartElevationAt(map, player.state) + windowJumpHeight(map, player.state),
    stairTransitionId: player.state.stairTransitionId,
    windowJumpId: player.state.windowJumpId,
    penaltySecondsLeft: player.state.penaltySecondsLeft,
    drivingHint: windowJumpHint(map, player.state) ?? routeDrivingHint(map, player.state, player.progress.nextCheckpoint),
    yaw: player.state.yaw,
    speed: speedOf(player.state),
    heldItem: player.heldItem,
    kartType: player.loadout.kartType,
    wheels: player.loadout.wheels,
    driftStage: player.state.driftStage,
    boosting: player.state.boostSeconds > 0,
    stunSecondsLeft: player.state.stunSecondsLeft,
    catnipSecondsLeft: player.state.catnipSecondsLeft,
    onCarpet: player.state.onCarpet,
    lap: player.progress.lap,
    nextCheckpoint: player.progress.nextCheckpoint,
    finished: player.progress.finished,
    place: places[index] ?? 0,
  }));
}

function worldItemReport(world: RaceWorld) {
  return {
    tankFire: { shells: world.tankFire.shells.length, explosions: world.tankFire.explosions.length },
    worldItems: {
      hairballs: world.hairballs.filter((hairball) => hairball.kind === 'hairball').length,
      yarnBalls: world.hairballs.filter((hairball) => hairball.kind === 'yarn').length,
      itemBoxesAvailable: world.itemBoxes.filter((box) => !box.collected).length,
      traps: world.traps.length,
      lasers: world.fieldItems.lasers.length,
      gravityBubbles: world.fieldItems.gravityBubbles.length,
      vacuumPulses: world.fieldItems.vacuumPulses.length,
    },
  };
}

/** Which game runs, what its strip says and which seats are out. */
function roundReport(gameId: string, info: RoundInfo | null, rules: ModeRules | null, seatCount: number, engineState: EngineSnapshot | null) {
  return {
    gameId,
    engineState,
    statusLines: info?.statusLines() ?? [],
    outSeats: Array.from({ length: seatCount }, (_, slot) => slot).filter((slot) => rules?.isOut(slot)),
  };
}
