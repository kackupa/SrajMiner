import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import Phaser from 'phaser';
import { MiningScene } from './game/MiningScene';
import './style.css';
document.querySelector('#app')!.innerHTML = '<div id="game"></div>';
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#131c20',
  pixelArt: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth, height: window.innerHeight - 142 },
  scene: [MiningScene],
  render: { roundPixels: true },
  audio: { noAudio: true },
});
