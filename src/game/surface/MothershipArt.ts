import type Phaser from 'phaser';

/** The same original expedition lander at touchdown, on its pad, and in flight. */
export function drawMothership(g: Phaser.GameObjects.Graphics,
  project: (x: number, y: number) => { x: number; y: number }, thrust: boolean) {
  const at = (x: number, y: number) => project(x * 1.5, y * 1.5);
  const poly = (color: number, points: number[][]) => {
    g.fillStyle(color); g.fillPoints(points.map(([x, y]) => at(x, y)), true);
  };
  const box = (x: number, y: number, w: number, h: number, color: number) =>
    poly(color, [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
  for (const side of [-1, 1]) {
    const x = side * 76;
    if (thrust) poly(0xf3be79, [[x-12,-23],[x+12,-23],[x+7,20],[x,38],[x-7,20]]);
    poly(0x596e78, [[x-20,-82],[x+20,-82],[x+23,-25],[x-23,-25]]);
    box(x-14,-73,28,7,0xa1b3b3);
    box(x-15,-32,30,10,0x1b2b36);
    poly(0xadc2bd, [[x-4,-27],[x+4,-27],[x+side*14,-7],[x+side*14-8,-7]]);
    box(x+side*12-15,-8,30,7,0x435763);
  }
  poly(0x293e4a, [[-87,-70],[-62,-104],[24,-112],[64,-92],[91,-62],[72,-30],[-68,-30]]);
  poly(0x92a8a9, [[-70,-72],[-49,-100],[20,-104],[55,-88],[70,-65],[57,-41],[-56,-41]]);
  poly(0xc2cbbd, [[-49,-100],[20,-104],[55,-88],[-42,-85]]);
  poly(0x233c4a, [[-37,-82],[19,-87],[46,-75],[40,-63],[-39,-63]]);
  box(-29,-78,17,10,0x8edccd); box(-7,-80,19,11,0x8edccd);
  box(17,-78,17,10,0x8edccd);
  box(-27,-56,49,26,0x344b55); box(-20,-52,35,22,0x172c37);
  poly(0x71858a, [[-20,-30],[15,-30],[31,-3],[-14,-3]]);
  for (let i=0;i<3;i++) box(-15+i*3,-24+i*7,32,2,0xb1ae91);
  box(41,-54,14,5,0xe4ad66); box(-56,-60,6,17,0xe4ad66);
}
