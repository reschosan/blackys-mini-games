const STAGE_COLORS = [0x4fc3f7, 0xffb300, 0xff4fd8] as const;
const BOOST_COLOR = 0xffffff;

export function tintForKart(driftStage: number, boosting: boolean): number | null {
  if (boosting) return BOOST_COLOR;
  return STAGE_COLORS[driftStage - 1] ?? null;
}
