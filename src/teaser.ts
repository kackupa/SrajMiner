import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import './teaser.css';
const gameplayHero = `${import.meta.env.BASE_URL}media/frontier-ship.webp`;
const workshopGameplay = `${import.meta.env.BASE_URL}media/frontier-mine.webp`;
const colonyGameplay = `${import.meta.env.BASE_URL}media/frontier-build.webp`;

const mark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 42 48"><path d="M4 3h34v42H4zM12 13h18M21 13v23m-8-8 8 8 8-8"/><circle cx="21" cy="23" r="3"/></svg></span>`;
const arrow = '<span aria-hidden="true">↗</span>';
const gameHref = `${import.meta.env.BASE_URL}game.html`;
const gameplayVideoUrl = `${import.meta.env.BASE_URL}media/frontier-gameplay.mp4`;

document.querySelector<HTMLDivElement>('#ore-frontier')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Ore Frontier home">${mark}<span><b>ORE FRONTIER</b><small>MINE · BUILD · EXPAND</small></span></a>
    <nav aria-label="Main navigation"><a href="#expedition">The game</a><a href="#roadmap">Roadmap</a><a href="#community">X / Community</a></nav>
    <a class="header-cta" href="${gameHref}">Play the current build ${arrow}</a>
  </header>

  <main id="top">
    <aside class="official-notice wrap" aria-label="Official token notice"><p>Ore Frontier has no official token at this time. Any token claiming affiliation is unauthorised.</p></aside>
    <section class="hero wrap">
      <div class="hero-copy">
        <div class="eyebrow"><i></i> EXPLORE · BUILD · FIGHT</div>
        <h1>Build your<br/><em>mining empire.</em></h1>
        <p class="hero-lede">Your mothership is home. Everything else is up to you. Dig for ore, kit out your miner and build an outpost worth defending.</p>
        <div class="hero-actions"><a class="button button-primary" href="${gameHref}">Play the early build <span aria-hidden="true">→</span></a><a class="text-link" href="#first-look">Watch real gameplay <span aria-hidden="true">↓</span></a></div>
        <div class="control-hint"><span>W</span><span>A</span><span>S</span><span>D</span><small>MOVE &amp; DRILL</small><b>·</b><small>NO DOWNLOAD</small></div>
      </div>
      <figure class="hero-art"><video id="hero-film" muted loop playsinline preload="none" poster="${gameplayHero}" aria-label="The miner and mothership in the current game"><source src="${import.meta.env.BASE_URL}media/frontier-mothership.mp4" type="video/mp4"/></video><button class="hero-film-toggle" type="button" aria-controls="hero-film">Play scene</button><figcaption class="hero-caption"><i></i> ACTUAL GAMEPLAY · YOUR FIRST HOME</figcaption></figure>
    </section>

    <section class="ticker" aria-label="Game features"><div><span>MINE ORE</span><i>✳</i><span>CHOOSE YOUR LOADOUT</span><i>✳</i><span>BUILD COLONIES</span><i>✳</i><span>DEFEND YOUR OUTPOST</span><i>✳</i><span>MINE ORE</span></div></section>

    <section id="expedition" class="expedition wrap">
      <div class="section-kicker"><span>01 / BUILD YOUR OPERATION</span><span>PLAY AT YOUR OWN PACE</span></div>
      <div class="expedition-heading"><h2>One miner.<br/><em>A growing operation.</em></h2><p>A warehouse beside your mine saves a trip home. A shelter gives you somewhere to recover. A turret buys you time when attackers show up. Build what you need, where you need it.</p></div>
      <div class="operation-steps">
        <article class="operation-step">
          <div class="operation-capture"><img src="${gameplayHero}" alt="The miner and mothership in the current Ore Frontier build" loading="lazy" width="1280" height="720"/></div>
          <div class="operation-copy"><span class="operation-number">01 / YOUR MOTHERSHIP</span><h3>Make yourself at home.</h3><p>Head out from the mothership and find a good spot. Come back with a full hold, unload your haul and get ready for another run.</p><span class="operation-detail">Quick unload · Repairs · A little covering fire</span></div>
        </article>
        <article class="operation-step">
          <div class="operation-capture"><img src="${workshopGameplay}" alt="The current miner exploring and drilling beneath the surface" loading="lazy" width="1440" height="900"/></div>
          <div class="operation-copy"><span class="operation-number">02 / YOUR MINER</span><h3>Build a rig you like using.</h3><p>Put your ore into new parts. Choose a hull, drill and weapon to suit the job, then take them out and see how they feel. Keep an eye on what’s living down there.</p><span class="operation-detail">Drill · Battery · Cargo · Hull · Engine</span></div>
        </article>
        <article class="operation-step">
          <div class="operation-capture"><img src="${colonyGameplay}" alt="A warehouse placement preview showing its footprint and automatic supports" loading="lazy" width="1440" height="900"/></div>
          <div class="operation-copy"><span class="operation-number">03 / COLONY</span><h3>Put down roots.</h3><p>Pick a spot and see your building before you place it. Add storage, extractors and defences as you go. It’s your outpost. There’s no set order to follow.</p><span class="operation-detail">Build · Store · Automate · Expand</span></div>
        </article>
      </div>
    </section>

    <section id="first-look" class="first-look">
      <div class="wrap first-look-inner">
        <div class="section-kicker"><span>02 / GAMEPLAY</span><span>CAPTURED IN THE CURRENT BUILD</span></div>
        <div class="first-look-layout">
          <div class="first-look-copy"><span class="eyebrow">ORE FRONTIER IN ACTION</span><h2>Take a look<br/><em>before you dig in.</em></h2><p>A short look at the current build. This is the game running in a browser, with the same miner, terrain and building tools you’ll play with.</p><a class="button button-outline" href="${gameHref}">Play the current build <span aria-hidden="true">→</span></a><small class="media-note">RECORDED IN GAME · EARLY BUILD</small></div>
          <figure class="gameplay-frame"><div class="frame-top"><span><i></i> GAMEPLAY / BETA PREVIEW</span><span>ORE FRONTIER&nbsp; · &nbsp;EARLY BUILD</span></div>${gameplayVideoUrl ? `<video controls playsinline preload="metadata" poster="${gameplayHero}" aria-label="Ore Frontier gameplay preview"><source src="${gameplayVideoUrl}" type="video/mp4"/></video>` : `<div class="gameplay-video-pending" role="status"><span aria-hidden="true">▶</span><b>GAMEPLAY PREVIEW</b><small>PUBLIC VIDEO HOST COMING SOON</small></div>`}<figcaption><span>DIGGING · FLIGHT · BUILDING</span><span>GAMEPLAY CAPTURE&nbsp; / &nbsp;CURRENT BUILD</span></figcaption></figure>
        </div>
      </div>
    </section>

    <section class="status-band"><div class="wrap status-content"><span class="status-dot"></span><div><small>PLAYABLE NOW · STILL IN DEVELOPMENT</small><p>Dig tunnels, choose your equipment, build an outpost and fight creatures and raiders. Play in your browser. No download needed.</p></div><a class="button button-primary" href="${gameHref}">Play Ore Frontier <span aria-hidden="true">→</span></a></div></section>

    <section id="roadmap" class="launch-section wrap">
      <div class="section-kicker"><span>03 / PRODUCT ROADMAP</span><span>DIRECTION, NOT FIXED DATES</span></div>
      <div class="launch-heading"><h2>Building toward<br/><em>multiplayer.</em></h2><p>The aim is a mining empire spread across worlds, with players trading the ores each planet has to offer. For now, come and help us make the single-player game better.</p></div>
      <ol class="roadmap-grid">
        <li><span class="phase-status">01 / AVAILABLE NOW</span><h3>Explore, build and fight</h3><p>Dig your own tunnels, fit new equipment and build your base. Creatures and armed raiders give your weapons and defences something to do.</p></li>
        <li><span class="phase-status">02 / BEING IMPROVED</span><h3>More reasons to head out</h3><p>Better encounters, clearer building tools and more satisfying equipment. We’re playing, testing and changing what doesn’t feel right.</p></li>
        <li><span class="phase-status">03 / PLANNED</span><h3>Global ore market</h3><p>Trade with other players and give rare planetary ores a bigger purpose. Connected player trading is not part of the playable campaign yet.</p></li>
      </ol>
    </section>

    <section id="community" class="community-band"><div class="wrap community-inner"><div><span class="eyebrow">04 / DEVELOPMENT UPDATES</span><h2>Follow the build<br/><em>on X.</em></h2><p>New builds, short gameplay clips and things we’re trying out. Tell us what felt good, what was confusing and what you want to build next.</p></div><a class="official-x" href="https://x.com/Kac_Kupa_" target="_blank" rel="noopener noreferrer"><span aria-hidden="true" class="x-mark">𝕏</span><strong>@Kac_Kupa_</strong><span>Official creator account</span><small>Follow on X ↗</small></a></div></section>

    <section id="faq" class="faq wrap">
      <div class="section-kicker"><span>05 / FAQ</span><span>GETTING STARTED</span></div>
      <div class="faq-layout"><div><h2>About<br/><em>Ore Frontier.</em></h2><p>A few things before you start.</p></div><div class="faq-list">
        <details><summary>What is Ore Frontier?<span>+</span></summary><p>A sandbox mining game. Explore, collect ore, choose equipment and build an outpost. You’ll also fight creatures and raiders, so leave yourself a way home.</p></details>
        <details><summary>Can I play it now?<span>+</span></summary><p>Yes. The current build is playable in your browser from the “Play” links on this page. It is still in development, so features and presentation will continue to change.</p></details>
        <details><summary>How do I control the miner?<span>+</span></summary><p>Use A/D or Left/Right to move, S/Down to drill down, and W/Up to fly up. Aim and hold the mouse button to drill toward ore. Hold Shift and click to fire an equipped weapon. Press B to build, F to unload near storage and G to repair near the mothership. The game also has on-screen touch controls.</p></details>
        <details><summary>Can I play on my phone?<span>+</span></summary><p>The game has touch controls and responsive screens. Phone testing is ongoing; landscape is currently the best way to play.</p></details>
        <details><summary>Can I trade ore with other players?<span>+</span></summary><p>Not in the campaign yet. You can sell ore for in-game Kredits once you have a market uplink. Trading with other players is planned.</p></details>
        <details><summary>When is the launch?<span>+</span></summary><p>The early build is playable now. A multiplayer beta release date has not been announced. Confirmed dates will be published here.</p></details>
      </div></div>
    </section>
  </main>

  <footer class="site-footer"><div class="wrap footer-inner"><a class="brand" href="#top">${mark}<span><b>ORE FRONTIER</b><small>MINE · BUILD · EXPAND</small></span></a><span>BUILD YOUR MINING EMPIRE.</span><a href="${gameHref}">PLAY THE CURRENT BUILD ${arrow}</a><small>IN DEVELOPMENT</small></div></footer>
`;

document.querySelectorAll<HTMLDetailsElement>('.faq-list details').forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    document.querySelectorAll<HTMLDetailsElement>('.faq-list details').forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

const heroFilm = document.querySelector<HTMLVideoElement>('#hero-film')!;
const heroToggle = document.querySelector<HTMLButtonElement>('.hero-film-toggle')!;
heroToggle.addEventListener('click', async () => {
  if (!heroFilm.paused) { heroFilm.pause(); return; }
  try { await heroFilm.play(); } catch { heroToggle.textContent = 'Try again'; }
});
heroFilm.addEventListener('play', () => { heroToggle.textContent = 'Pause scene'; });
heroFilm.addEventListener('pause', () => { heroToggle.textContent = 'Play scene'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) heroFilm.pause(); });
