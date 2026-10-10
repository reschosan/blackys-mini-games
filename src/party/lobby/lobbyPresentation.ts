import type { GameCard } from '../../shared/game/gameCard';
import type { GraphicsQuality } from '../../shared/config/graphics';
import type { KartStatsTable } from '../../shared/config/kartLoadout';
import { PLANE_TYPES } from '../../shared/config/planeTypes';
import { MAX_PLAYERS, PLAYER_APPEARANCES } from '../../shared/config/players';
import { CatPreview } from '../../games/kart/kart/views/catPreview';
import type { JoinedPlayer } from '../../shared/input/inputManager';
import { MapPreview } from '../../games/kart/maps/shared/view/mapPreview';
import { AVAILABLE_MAPS } from '../../games/kart/maps/registry';
import type { AiSlotView } from './aiSlotCard';
import { previewSubjectOf, type CustomizationEntry } from './catCustomization';
import { LobbyView } from './lobby';
import type { MapVotePick } from './mapVote';
import { MapVoteView } from './mapVoteView';
import { GameVoteView } from './gameVoteView';
import { GAMES } from '../games';

export class LobbyPresentation {
  readonly lobby: LobbyView;
  private readonly vote: MapVoteView;
  private readonly gameVote: GameVoteView;
  private readonly cats = new Map<number, CatPreview>();
  private readonly maps = new Map<number, MapPreview>();

  constructor(overlay: HTMLElement, callbacks: ConstructorParameters<typeof LobbyView>[1]) {
    this.lobby = new LobbyView(overlay, callbacks);
    this.vote = new MapVoteView(overlay, callbacks);
    this.gameVote = new GameVoteView(overlay, callbacks);
  }

  showLobby(
    joined: readonly JoinedPlayer[],
    entryFor: (player: JoinedPlayer) => CustomizationEntry | undefined,
    aiSlots: readonly (AiSlotView | null)[],
    muted: boolean,
    graphicsQuality: GraphicsQuality,
    kartStats: KartStatsTable,
    frameSeconds: number,
  ): void {
    this.vote.hide();
    this.gameVote.hide();
    this.disposeMaps();
    this.lobby.show();
    this.lobby.update(joined, entryFor, aiSlots, muted, graphicsQuality, kartStats);
    const firstEntry = joined[0] ? entryFor(joined[0]) : undefined;
    const aiPage = firstEntry?.page ?? 'start';
    for (let index = 0; index < MAX_PLAYERS; index += 1) {
      const player = joined[index];
      const entry = player ? entryFor(player) : undefined;
      const ai = aiSlots[index];
      const container = this.lobby.previewContainer(index);
      const look =
        entry ?? (ai ? { appearance: ai.appearance, loadout: ai.loadout, page: aiPage, plane: PLANE_TYPES[index % PLANE_TYPES.length]! } : undefined);
      if (!look || !container) {
        this.removeCat(index);
        continue;
      }
      this.showCat(index, look, container, frameSeconds);
    }
  }

  /** The live preview of one player's card: the cat in the kart, or in the plane while the plane page is open. */
  private showCat(
    index: number,
    entry: Pick<CustomizationEntry, 'appearance' | 'loadout' | 'page' | 'plane'>,
    container: HTMLElement,
    frameSeconds: number,
  ): void {
    let preview = this.cats.get(index);
    if (!preview) {
      preview = new CatPreview(entry.appearance, entry.loadout, PLAYER_APPEARANCES[index]?.bodyColor ?? 0xffffff);
      preview.setAngle('front');
      this.cats.set(index, preview);
    } else {
      preview.setAppearance(entry.appearance);
      preview.setLoadout(entry.loadout);
    }
    preview.show(previewSubjectOf(entry));
    container.appendChild(preview.canvasElement);
    preview.render(frameSeconds);
  }

  showGameVote(joined: readonly JoinedPlayer[], pickFor: (player: JoinedPlayer) => MapVotePick | undefined, nameFor: (index: number) => string): void {
    this.disposeCats();
    this.disposeMaps();
    this.lobby.hide();
    this.vote.hide();
    this.gameVote.show();
    this.gameVote.update(GAMES, joined, pickFor, nameFor);
  }

  showVote(
    joined: readonly JoinedPlayer[],
    pickFor: (player: JoinedPlayer) => MapVotePick | undefined,
    nameFor: (index: number) => string,
    warmPreview: (preview: MapPreview) => void,
    game: GameCard,
  ): void {
    this.disposeCats();
    this.lobby.hide();
    this.gameVote.hide();
    this.vote.show();
    this.vote.update(
      AVAILABLE_MAPS.map((map) => ({ name: map.name })),
      joined,
      pickFor,
      nameFor,
      game,
    );
    AVAILABLE_MAPS.forEach((map, index) => {
      const container = this.vote.previewContainer(index);
      if (!container) return;
      let preview = this.maps.get(index);
      if (!preview) {
        preview = new MapPreview(map);
        preview.render();
        this.maps.set(index, preview);
      }
      preview.render();
      warmPreview(preview);
      container.appendChild(preview.canvasElement);
    });
  }

  hide(): void {
    this.vote.hide();
    this.gameVote.hide();
    this.disposeMaps();
    this.lobby.hide();
    this.disposeCats();
  }

  private removeCat(index: number): void {
    const preview = this.cats.get(index);
    if (!preview) return;
    preview.dispose();
    this.cats.delete(index);
  }

  private disposeCats(): void {
    for (const index of this.cats.keys()) this.removeCat(index);
  }

  private disposeMaps(): void {
    for (const preview of this.maps.values()) preview.dispose();
    this.maps.clear();
  }
}
