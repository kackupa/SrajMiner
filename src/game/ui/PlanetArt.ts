import { MAPS, CIVILISATIONS, type MapId, type CivilisationId } from '../config';

let sequence = 0;
/** Original vector planet illustrations: never remote assets. */
export function planetArt(id: MapId | CivilisationId, development = 0) {
  const uid = `planet-${++sequence}`;
  const inhabited = id in CIVILISATIONS;
  const palette: Record<string, [string, string]> = {
    'mars-frontier': ['#e8ad70','#954b30'], 'cryo-shelf': ['#d4f8ff','#43859b'],
    'hull-graveyard': ['#a5b0b3','#4b515c'], 'vesper-9': ['#a6c98c','#345744'],
    'cinder-vale': ['#ffb36a','#632a26'], 'prism-fault': ['#d4adff','#664894'],
    helion: ['#82cddd','#24627e'], kepler: ['#abb9de','#424b75'],
    verdant: ['#c4e59b','#427b55'], lyra: ['#e3d6ff','#6662a3'],
  };
  const [color, mid] = palette[id];
  const features: Record<string, string> = {
    'mars-frontier': '<path d="M18 80Q65 40 110 86T185 105M30 120Q80 78 150 141" stroke="#e6b17a" stroke-width="12" fill="none" opacity=".35"/><path d="m45 120 30-28 17 8 30-18 30 10" stroke="#4b2825" stroke-width="7" fill="none"/>',
    'cryo-shelf': '<path d="m35 45 35-23 27 27-14 32-39 5zm66 86 21-32 48 15-7 44-35 14z" fill="#e5ffff" opacity=".5"/>',
    'hull-graveyard': '<g fill="#abb8bf" stroke="#283039" stroke-width="2"><path d="m41 61 38 8-4 12-38-8zm69 62 31-13 7 15-31 13zM87 38h14v27H87z"/></g>',
    'vesper-9': '<path d="M30 110Q60 40 95 105T179 79" stroke="#b1eb76" stroke-width="9" fill="none" opacity=".45"/><circle cx="63" cy="65" r="20" fill="#244333" stroke="#a0b984" stroke-width="4"/>',
    'cinder-vale': '<circle cx="65" cy="62" r="19" fill="#ffb052" opacity=".5"/><circle cx="65" cy="62" r="12" fill="#452222"/>',
    'prism-fault': '<g fill="#dcc5ff" stroke="#8a6ab2" stroke-width="2"><path d="m80 22 12 28-9 22-15-27zm35 92 18-29 12 39-15 27zm-67-8 8 25-14 17-8-28z"/></g>',
    helion: '<path d="M35 50Q80 75 90 41M120 135q22-44 50-36" fill="none" stroke="#b7dfad" stroke-width="16" opacity=".6"/>',
    kepler: '<path d="M15 95h170M30 108h145" stroke="#b4bccd" stroke-width="5" opacity=".5"/><path d="M42 55h20v32H42zm80 60h30v20h-30z" fill="#8095ac"/>',
    verdant: '<path d="M38 33q60 20 25 73t40 61M125 30q-24 39 34 64" stroke="#b4d780" stroke-width="22" fill="none" opacity=".65"/><path d="M45 40q55 38 26 84" stroke="#72c7db" stroke-width="4" fill="none"/>',
    lyra: '<path d="M100 18v164M18 100h164" stroke="#ded3fc" stroke-width="3" opacity=".55"/><circle cx="100" cy="100" r="48" fill="none" stroke="#b3b8fa" stroke-width="8" opacity=".4"/>',
  };
  const ice = id === 'cryo-shelf', lava = id === 'cinder-vale', crystal = id === 'prism-fault';
  const cities = inhabited ? Array.from({ length: 25 + development * 16 }, (_, i) => {
    const angle = i * 2.399, r = 15 + (i * 17 % 68);
    return `<circle cx="${100 + Math.cos(angle) * r}" cy="${100 + Math.sin(angle) * r * .85}" r="${i % 5 ? .8 : 1.6}" fill="#ffe0a2"/>`;
  }).join('') : '';
  const seams = lava
    ? '<path d="M41 24 65 47 61 69 88 84 79 108 107 129 116 173M88 84 127 75 153 99 176 104M107 129 70 151" fill="none" stroke="#ff9857" stroke-width="3" opacity=".85"/>'
    : ice ? '<path d="M41 26 72 56 66 87 94 109 82 145M66 87 34 108M94 109 132 102 161 128" fill="none" stroke="#efffff" stroke-width="1.6" opacity=".5"/>'
    : crystal ? '<path d="m38 55 24-17 15 33-21 16zm72 48 25-28 25 39-32 12zM69 131l22-12 13 29-24 16z" fill="#b7a0e2" opacity=".4"/>'
    : Array.from({length:18},(_,i)=>{const x=30+(i*43%143),y=26+(i*31%148),r=3+i%8;return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.66}" fill="${inhabited?'#183b48':'#0c202b'}" opacity=".3" stroke="${color}" stroke-opacity=".2"/>`;}).join('');
  return `<svg class="planet-art ${inhabited ? 'inhabited' : ''}" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="${uid}-surface" cx="28%" cy="25%"><stop stop-color="${color}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="#09131f"/></radialGradient><clipPath id="${uid}-clip"><circle cx="100" cy="100" r="82"/></clipPath></defs><circle cx="100" cy="100" r="88" fill="${color}" opacity=".07"/><circle cx="100" cy="100" r="83" fill="none" stroke="${color}" stroke-opacity=".5"/><circle cx="100" cy="100" r="82" fill="url(#${uid}-surface)"/><g clip-path="url(#${uid}-clip)"><path d="M33 32 59 29 76 44 69 61 95 70 88 93 67 101 71 127 55 143 34 125 22 82zm88 58 22-17 36 16 8 24-23 20-12 40-29-18 7-28-21-16z" fill="${ice ? '#d1eaeb' : inhabited ? '#60766d' : '#152b38'}" opacity=".62"/>${seams}${features[id]}<g class="planet-clouds"><path d="M-12 67 Q75 36 207 63M-10 126 Q113 155 210 119" stroke="#eefbff" stroke-width="9" fill="none" opacity=".14"/></g>${cities}</g>${id === 'kepler' || id === 'hull-graveyard' ? '<ellipse cx="100" cy="105" rx="98" ry="28" transform="rotate(-24 100 105)" fill="none" stroke="#afbac3" stroke-width="3" stroke-dasharray="30 7 10 5"/>' : ''}${inhabited ? '<ellipse cx="100" cy="100" rx="94" ry="36" transform="rotate(30 100 100)" fill="none" stroke="#e5c989" stroke-width="1.3" opacity=".6"/><g transform="translate(166 143) rotate(30)" fill="#d3e2e9" stroke="#243d51" stroke-width="2"><rect x="-9" y="-6" width="18" height="12"/><path d="M-24-9h12V9h-12zm36 0h12V9H12z" fill="#72b8c9"/></g><g class="orbital-traffic"><circle cx="100" cy="8" r="2" fill="#f7d99e"/><path d="M96 8h-12" stroke="#f7d99e" opacity=".4"/></g>' : ''}</svg>`;
}

export function atlasMarkup(selected: MapId = 'cryo-shelf', current: MapId = selected) {
  const positions = [[16,27],[42,19],[72,24],[83,67],[48,75],[15,71]];
  const ids = ['mars-frontier','cryo-shelf','hull-graveyard','prism-fault','cinder-vale','vesper-9'] as MapId[];
  return `<section class="system-atlas" aria-label="Vesper system route map"><div class="atlas-map"><div class="system-orbits" aria-hidden="true"></div><div class="system-star" aria-hidden="true">✦</div>${ids.map((id,i)=>`<button class="atlas-world ${id===selected?'selected':''}" data-world="${id}" data-title="${MAPS[id].name}" data-copy="${MAPS[id].strata.join(' · ')}. ${id==='vesper-9'?'Five recovered cores reveal this world.':'Survey the resource profile in the flight deck. Core fuel is required for departure.'}" style="--px:${positions[i][0]}%;--py:${positions[i][1]}%" aria-pressed="${id===selected}">${planetArt(id)}<strong>${MAPS[id].name}</strong><small>${id===current?'CURRENT WORLD':id==='vesper-9'?'UNCHARTED':'MINING WORLD'}</small></button>`).join('')}</div><div class="atlas-preview" aria-live="polite"><b id="atlas-title">${MAPS[selected].name}</b><p id="atlas-copy">An expedition begins with a foothold. Build your camp, survey the deep seams, and recover core fuel for the next crossing.</p></div></section>`;
}
