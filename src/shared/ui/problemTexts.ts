import { t } from '../i18n';

export interface FatalProblem {
  readonly title: string;
  readonly text: string;
  readonly buttonLabel: string | null;
}

export interface ProblemNotice {
  readonly text: string;
  readonly seconds: number;
}

/** Every problem is made when it is shown, in the language being shown. */
export function webglUnavailable(): FatalProblem {
  const { problems } = t();
  return { title: problems.webglTitle, text: problems.webglText, buttonLabel: problems.tryAgain };
}

export function graphicsInterrupted(): FatalProblem {
  const { problems } = t();
  return { title: problems.graphicsNapTitle, text: problems.graphicsRecovering, buttonLabel: null };
}

export function graphicsLost(): FatalProblem {
  const { problems } = t();
  return { title: problems.graphicsNapTitle, text: problems.graphicsLostText, buttonLabel: problems.reloadPage };
}

export function gameLoopFailed(): FatalProblem {
  const { problems } = t();
  return { title: problems.gameLoopTitle, text: problems.gameLoopText, buttonLabel: problems.reloadPage };
}

export function catModelMissing(): ProblemNotice {
  return { text: t().problems.catModelMissing, seconds: 8 };
}

export function audioUnavailable(): ProblemNotice {
  return { text: t().problems.audioUnavailable, seconds: 6 };
}

export function mapModelsMissing(mapName: string): ProblemNotice {
  return { text: t().problems.mapModelsMissing(mapName), seconds: 8 };
}

/** Seconds after a lost graphics context before the game stops hoping it comes back. */
export const GRAPHICS_RESTORE_WAIT_SECONDS = 5;

export function graphicsLowered(): ProblemNotice {
  return { text: t().problems.graphicsLowered, seconds: 6 };
}

export function graphicsEmergency(): ProblemNotice {
  return { text: t().problems.graphicsEmergency, seconds: 6 };
}
