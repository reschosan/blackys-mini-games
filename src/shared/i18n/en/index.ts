import { cats } from './cats';
import { controls } from './controls';
import { games } from './games';
import { invite } from './invite';
import { join } from './join';
import { lobby } from './lobby';
import { menus } from './menus';
import { pages } from './pages';
import { places } from './places';
import { problems } from './problems';
import { race } from './race';

/** The English texts: the main language and the template every other language follows. */
export const EN = { menus, pages, lobby, cats, games, race, places, problems, invite, join, controls };

/** Every language has exactly these texts; TypeScript reports a missing one. */
export type Texts = typeof EN;
