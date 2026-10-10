import '../../shared/ui/tailwind.css';
import '../../shared/ui/components';
import { watchScreenSize } from '../app/screenSize';
import { JoinPage } from './joinPage';
import { t } from '../../shared/i18n';
import { onLanguageChange } from '../../shared/i18n/language';

const overlay = document.querySelector<HTMLElement>('#overlay');
const touchRoot = document.querySelector<HTMLElement>('#touch-controls');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!overlay || !touchRoot || !canvas) throw new Error('join page markup incomplete');

watchScreenSize(window, document.documentElement);
const showTitle = (): void => {
  document.title = t().join.pageTitle;
};
showTitle();
onLanguageChange(showTitle);
new JoinPage(overlay, touchRoot, canvas).start();
