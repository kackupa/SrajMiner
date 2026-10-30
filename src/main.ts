import { installStudyControls } from './game/study/VisualStudy';
import './game/study/VisualStudy.css';
import { installGameButtons } from './game/ui/GameButtons';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import Phaser from 'phaser';
import './style.css';
import './presentation.css';
import './industrial.css';
import './camp.css';
document.querySelector('#app')!.innerHTML = '<div id="game"></div>';
const stopButtonStyles=installGameButtons(document.querySelector<HTMLElement>('#app')!);
if(import.meta.hot)import.meta.hot.dispose(stopButtonStyles);
const uniformPlanetTest = new URLSearchParams(location.search).get('uniform-test') === '1';
// Do not even initialise campaign/account modules in the disposable terrain test.
void (uniformPlanetTest
  ? import('./game/study/UniformPlanetScene').then(module => module.UniformPlanetScene)
  : import('./game/MiningScene').then(module => module.MiningScene)
).then(scene => new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#131c20',
  pixelArt: false,
  antialias: true,
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth, height: window.innerHeight - 142 },
  scene: [scene],
  render: { roundPixels: false },
  audio: { noAudio: true },
}));

import './expedition.css';

import './mobile.css';

import './frontier.css';

import './game/ui/StarMap.css';

import './game/ui/BuildingCatalogue.css';

import './game/ui/RigWorkshop.css';
import './game/ui/LoadoutView.css';

import './game/ui/ColonyOverview.css';

import './game/ui/ColonyOrders.css';
import './game/ui/FreightView.css';
import './game/ui/AccountPanel.css';
import './game/ui/VerifiedMiningPanel.css';

// Last: shared button tokens and states override legacy panel skins.
import './game/ui/GameButtons.css';

import './game/ui/Cockpit.css';

if (!uniformPlanetTest) installStudyControls();
