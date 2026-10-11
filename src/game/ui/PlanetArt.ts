import { MAPS, CIVILISATIONS, type MapId, type CivilisationId } from '../config';

let sequence = 0;
/** Original vector planet illustrations: never remote assets. */
export function planetArt(id: MapId | CivilisationId, development = 0) {
  const uid = `planet-${++sequence}`;
  const inhabited = id in CIVILISATIONS;
  const color = inhabited ? CIVILISATIONS[id as CivilisationId].color : `#${MAPS[id as MapId].surface.edge.toString(16).padStart(6, '0')}`;
  const ice = id === 'cryo-shelf', lava = id === 'cinder-vale', crystal = id === 'prism-fault';
  const cities = inhabited ? Array.from({ length: 25 + development * 16 }, (_, i) => {
    const angle = i * 2.399, r = 15 + (i * 17 % 68);
    return `<circle cx="${100 + Math.cos(angle) * r}" cy="${100 + Math.sin(angle) * r * .85}" r="${i % 5 ? .8 : 1.6}" fill="#ffe0a2"/>`;
  }).join('') : '';
  const seams = Array.from({ length: 9 }, (_, i) => `<path d="M${20+i*21} 12 Q${i*17} 72 ${35+i*20} 104 T${i*29} 200" stroke="${lava ? '#ffad62' : ice ? '#e2ffff' : color}" stroke-width="${ice || crystal ? 2 : 8}" opacity="${lava ? .8 : .3}" fill="none"/>`).join('');
  return `<svg class="planet-art ${inhabited ? 'inhabited' : ''}" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="${uid}-surface" cx="28%" cy="25%"><stop stop-color="${color}"/><stop offset=".6" stop-color="${lava ? '#6f3032' : '#325466'}"/><stop offset="1" stop-color="#09131f"/></radialGradient><clipPath id="${uid}-clip"><circle cx="100" cy="100" r="82"/></clipPath></defs><circle cx="100" cy="100" r="88" fill="${color}" opacity=".07"/><circle cx="100" cy="100" r="83" fill="none" stroke="${color}" stroke-opacity=".5"/><circle cx="100" cy="100" r="82" fill="url(#${uid}-surface)"/><g clip-path="url(#${uid}-clip)"><path d="M33 32 59 29 76 44 69 61 95 70 88 93 67 101 71 127 55 143 34 125 22 82zm88 58 22-17 36 16 8 24-23 20-12 40-29-18 7-28-21-16z" fill="${ice ? '#d1eaeb' : inhabited ? '#60766d' : '#152b38'}" opacity=".62"/>${seams}<g class="planet-clouds"><path d="M-12 67 Q75 36 207 63M-10 126 Q113 155 210 119" stroke="#eefbff" stroke-width="9" fill="none" opacity=".14"/></g>${cities}</g>${id === 'kepler' || id === 'hull-graveyard' ? '<ellipse cx="100" cy="105" rx="98" ry="28" transform="rotate(-24 100 105)" fill="none" stroke="#afbac3" stroke-width="3" stroke-dasharray="30 7 10 5"/>' : ''}${inhabited ? '<g class="orbital-traffic"><circle cx="100" cy="8" r="2" fill="#f7d99e"/><path d="M96 8h-12" stroke="#f7d99e" opacity=".4"/></g>' : ''}</svg>`;
}

export function atlasMarkup(selected: MapId = 'cryo-shelf') {
  const positions = [[16,27],[42,19],[72,24],[83,67],[48,75],[15,71]];
  const ids = ['mars-frontier','cryo-shelf','hull-graveyard','prism-fault','cinder-vale','vesper-9'] as MapId[];
  return `<section class="system-atlas" aria-label="Vesper system route map"><div class="atlas-map"><div class="system-orbits" aria-hidden="true"></div><div class="system-star" aria-hidden="true">✦</div>${ids.map((id,i)=>`<button class="atlas-world ${id===selected?'selected':''}" data-world="${id}" data-title="${MAPS[id].name}" data-copy="${MAPS[id].strata.join(' · ')}. ${id==='vesper-9'?'Five recovered cores reveal this world.':'Survey the resource profile in the flight deck. Core fuel is required for departure.'}" style="--px:${positions[i][0]}%;--py:${positions[i][1]}%" aria-pressed="${id===selected}">${planetArt(id)}<strong>${MAPS[id].name}</strong><small>${id===selected?'CURRENT WORLD':id==='vesper-9'?'UNCHARTED':'MINING WORLD'}</small></button>`).join('')}</div><div class="atlas-preview" aria-live="polite"><b id="atlas-title">${MAPS[selected].name}</b><p id="atlas-copy">An expedition begins with a foothold. Build your camp, survey the deep seams, and recover core fuel for the next crossing.</p></div></section>`;
}
