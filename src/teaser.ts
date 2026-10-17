import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import './teaser.css';
import gameplayStill from './assets/teaser/underground-run.png';

const mark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 42 48"><path d="M4 3h34v42H4zM12 13h18M21 13v23m-8-8 8 8 8-8"/><circle cx="21" cy="23" r="3"/></svg></span>`;
const arrow = '<span aria-hidden="true">↗</span>';
const gameHref = import.meta.env.BASE_URL === '/' ? '/play' : import.meta.env.BASE_URL;

document.querySelector<HTMLDivElement>('#ore-frontier')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Ore Frontier home">${mark}<span><b>ORE FRONTIER</b><small>AN INDEPENDENT MINING EXPEDITION</small></span></a>
    <nav aria-label="Main navigation"><a href="#expedition">The game</a><a href="#token">Token</a><a href="#tokenomics">Tokenomics</a><a href="#roadmap">Roadmap</a><a href="#community">X / Community</a></nav>
    <a class="header-cta" href="${gameHref}">Play the current build ${arrow}</a>
  </header>

  <main id="top">
    <section class="hero wrap">
      <div class="hero-copy">
        <div class="eyebrow"><i></i> LAUNCHING SOON · BROWSER MINING GAME</div>
        <h1>The deeper<br/>you go, the <em>stranger</em><br/>it gets.</h1>
        <p class="hero-lede">Ore Frontier is a browser mining game. Drill through alien worlds, haul ore home, upgrade your rig, and build your next expedition. A new frontier for players and the crypto community is coming soon.</p>
        <div class="hero-actions"><a class="button button-primary" href="${gameHref}">Enter the current build <span aria-hidden="true">→</span></a><a class="text-link" href="#first-look">Take a first look <span aria-hidden="true">↓</span></a></div>
        <div class="control-hint"><span>W</span><span>A</span><span>S</span><span>D</span><small>MOVE &amp; DRILL</small><b>·</b><small>NO DOWNLOAD</small></div>
      </div>
      <div class="hero-art" aria-label="A mining pod descends into a mineral-rich alien world">
        <div class="hero-planet"></div><div class="hero-horizon"></div><div class="hero-star star-a">✦</div><div class="hero-star star-b">·</div><div class="hero-star star-c">·</div>
        <div class="hero-readout"><span>FIELD NOTE&nbsp; 01</span><b>THE FIRST DESCENT</b><small>CRYO SHELF · DEPTH 142 M</small></div>
        <div class="hero-cave"><span class="ore-vein vein-one"></span><span class="ore-vein vein-two"></span><span class="ore-vein vein-three"></span></div>
        <div class="hero-pod"><span class="pod-window"></span><span class="pod-cabin"></span><span class="pod-leg pod-leg-left"></span><span class="pod-leg pod-leg-right"></span><span class="pod-light"></span></div>
        <div class="hero-depth"><small>DESCENT LOG</small><b>00:04:18</b><span>KEEP GOING ↓</span></div>
        <div class="hero-caption"><i></i> A LITTLE DEEPER. A LITTLE RICHER.</div>
      </div>
      <div class="hero-index"><span>FIELD GUIDE</span><span>01 / 07</span><span>↘</span></div>
    </section>

    <section class="ticker" aria-label="Game features"><div><span>DRILL YOUR OWN ROUTE</span><i>✳</i><span>READ THE ROCK</span><i>✳</i><span>MAKE IT BACK</span><i>✳</i><span>BUILD THE NEXT RUN</span><i>✳</i><span>DRILL YOUR OWN ROUTE</span></div></section>

    <section id="expedition" class="expedition wrap">
      <div class="section-kicker"><span>01 / THE EXPEDITION</span><span>EVERY RUN IS YOURS</span></div>
      <div class="expedition-heading"><h2>Go down.<br/><em>Come back different.</em></h2><p>There’s no marked trail beneath the surface. Your drill makes one. Every haul buys a little more reach, a little more room, and another reason to push on.</p></div>
      <div class="feature-grid">
        <article class="feature-card"><div class="feature-art geology-art" aria-hidden="true"><span></span><span></span><span></span><i>◆</i></div><span class="feature-no">01 — READ THE STRATA</span><h3>Find your way through.</h3><p>Different layers hide different ores. Cut a careful route, follow the seams, and keep an eye on the way back.</p></article>
        <article class="feature-card"><div class="feature-art pod-art" aria-hidden="true"><span class="pod-mini"><i></i></span><span class="pulse pulse-a"></span><span class="pulse pulse-b"></span><b>↘</b></div><span class="feature-no">02 — WATCH YOUR RIG</span><h3>Know when to turn.</h3><p>Battery, hull and cargo all matter. One more pocket can be the best call of the run—or the one that costs you.</p></article>
        <article class="feature-card"><div class="feature-art camp-art" aria-hidden="true"><span class="camp-roof"></span><span class="camp-body"></span><span class="camp-light"></span><i>+</i></div><span class="feature-no">03 — BUILD THE NEXT RUN</span><h3>Make the haul count.</h3><p>Bring ore home to sell, repair, and improve your miner. Then head out again with a deeper plan.</p></article>
      </div>
    </section>

    <section id="first-look" class="first-look">
      <div class="wrap first-look-inner">
        <div class="section-kicker"><span>02 / FIRST LOOK</span><span>CAPTURED IN THE CURRENT BUILD</span></div>
        <div class="first-look-layout">
          <div class="first-look-copy"><span class="eyebrow">A RUN BELOW THE CRUST</span><h2>Not a mock-up.<br/><em>A real descent.</em></h2><p>Here’s a glimpse of the game as it plays today. We’re working on the next cut of the trailer while the expedition keeps growing.</p><a class="button button-outline" href="${gameHref}">Play the current build <span aria-hidden="true">→</span></a><small class="media-note">GAMEPLAY CLIP IN PROGRESS · THIS STILL IS FROM THE LIVE BUILD</small></div>
          <figure class="gameplay-frame"><div class="frame-top"><span><i></i> LIVE FEED / SUBSURFACE</span><span>CRYO SHELF&nbsp; · &nbsp;142 M</span></div><img src="${gameplayStill}" alt="Ore Frontier gameplay: the miner cutting through ore-rich underground rock"/><figcaption><span>THE FIRST CUT</span><span>GAMEPLAY STILL&nbsp; / &nbsp;CURRENT BUILD</span></figcaption></figure>
        </div>
      </div>
    </section>

    <section class="status-band"><div class="wrap status-content"><span class="status-dot"></span><div><small>LAUNCHING SOON · EARLY BUILD AVAILABLE</small><p>Try the mining loop today. The full launch is ahead; the release date and token launch details are still to be announced.</p></div><a class="button button-primary" href="${gameHref}">Play Ore Frontier <span aria-hidden="true">→</span></a></div></section>

    <section id="token" class="launch-section wrap">
      <div class="section-kicker"><span>03 / THE TOKEN</span><span>PROPOSED UTILITY · NOT LIVE</span></div>
      <div class="launch-heading"><h2>A token with<br/><em>a job to do.</em></h2><p>The proposed direction: a utility token for optional experiences and expression within Ore Frontier. These uses are a design proposal, not features in the current build.</p></div>
      <div class="utility-grid">
        <article><span class="feature-no">01 / MAKE IT YOURS</span><h3>Rig &amp; colony cosmetics</h3><p>Proposed use: spend tokens on optional visual customisation for your miner and your operation.</p></article>
        <article><span class="feature-no">02 / GO SOMEWHERE NEW</span><h3>Special expeditions</h3><p>Proposed use: access optional themed expeditions and seasonal experiences as the game expands.</p></article>
        <article><span class="feature-no">03 / SHAPE THE FRONTIER</span><h3>Community participation</h3><p>Proposed use: participate in decisions about future themes and cosmetic releases. The voting model is still to be defined.</p></article>
      </div>
      <div class="value-panel"><span class="eyebrow">WHAT COULD DRIVE TOKEN DEMAND?</span><h3>A game people want to return to.</h3><p>More players and worthwhile optional content could create demand to use the token. That depends on shipping utility people actually want, alongside transparent supply and unlock schedules. Gameplay activity alone does not guarantee token value.</p><p class="token-note">The early build uses in-game credits and ore. Neither is an on-chain token or a promise of a future token allocation. Token utility is not implemented yet.</p></div>
    </section>

    <section id="tokenomics" class="tokenomics-band"><div class="wrap launch-section">
      <div class="section-kicker"><span>04 / TOKENOMICS</span><span>DETAILS TO BE ANNOUNCED</span></div>
      <div class="launch-heading"><h2>The supply.<br/><em>The full picture.</em></h2><p>The token model is being defined. This is the place for the final distribution and unlock schedule once the details are confirmed.</p></div>
      <dl class="token-facts"><div><dt>Token name &amp; ticker</dt><dd>TBA</dd></div><div><dt>Network &amp; contract</dt><dd>TBA</dd></div><div><dt>Total supply</dt><dd>TBA</dd></div><div><dt>Launch circulation</dt><dd>TBA</dd></div><div><dt>Allocation breakdown</dt><dd>TBA</dd></div><div><dt>Vesting &amp; unlocks</dt><dd>TBA</dd></div></dl>
      <p class="token-note">Allocation percentages, liquidity, emissions, and any burn or buyback mechanisms are unconfirmed. No sale or contract is linked from this page.</p>
    </div></section>

    <section id="roadmap" class="launch-section wrap">
      <div class="section-kicker"><span>05 / PRODUCT ROADMAP</span><span>DIRECTION, NOT FIXED DATES</span></div>
      <div class="launch-heading"><h2>From first cut<br/><em>to new frontiers.</em></h2><p>Build the game, refine the experience, then bring the token utility to life. Later milestones depend on testing and a confirmed token model.</p></div>
      <ol class="roadmap-grid">
        <li><span class="phase-status">01 / AVAILABLE NOW</span><h3>The first descent</h3><p>Playable browser build with mining, ore collection, rig upgrades, colony building, and planetary travel.</p></li>
        <li><span class="phase-status">02 / NEXT · LAUNCH</span><h3>Ready for more miners</h3><p>Polish onboarding, return navigation, balance, and mobile controls. Prepare launch gameplay and open community channels.</p></li>
        <li><span class="phase-status">03 / PLANNED</span><h3>Define the token</h3><p>Confirm the network, utility, supply, allocations, and vesting. Publish the full token model and launch details.</p></li>
        <li><span class="phase-status">04 / PROPOSED</span><h3>Expand the frontier</h3><p>Develop optional cosmetics and special expeditions, test token integration, and grow the game with player feedback.</p></li>
      </ol>
    </section>

    <section id="community" class="community-band"><div class="wrap community-inner"><div><span class="eyebrow">06 / FOLLOW THE EXPEDITION</span><h2>The next signal<br/><em>lands on X.</em></h2><p>Gameplay clips, development updates, and launch news. Our official account will be linked here when it’s ready.</p></div><div class="x-placeholder"><span aria-hidden="true" class="x-mark">𝕏</span><strong>Official X account</strong><span>COMING SOON</span><small>Account link to be announced</small></div></div></section>

    <section id="faq" class="faq wrap">
      <div class="section-kicker"><span>07 / FIELD QUESTIONS</span><span>BEFORE YOU DROP</span></div>
      <div class="faq-layout"><div><h2>Before you<br/><em>head below.</em></h2><p>The quick answers for a new prospector.</p></div><div class="faq-list">
        <details><summary>What is Ore Frontier?<span>+</span></summary><p>A browser-based mining game about drilling through alien worlds, collecting ore, and getting your miner safely home.</p></details>
        <details><summary>Can I play it now?<span>+</span></summary><p>Yes. The current build is playable in your browser from the “Play” links on this page. It is still in development, so features and presentation will continue to change.</p></details>
        <details><summary>How do I control the miner?<span>+</span></summary><p>Use WASD or the arrow keys to move and drill, and W or the up arrow to thrust. The in-game How to Play screen explains the controls and return trip.</p></details>
        <details><summary>Can I play on my phone?<span>+</span></summary><p>The game has touch controls and responsive screens. Phone testing is ongoing; landscape is currently the best way to play.</p></details>
        <details><summary>When is the launch?<span>+</span></summary><p>Launching soon. An exact release date and token timeline have not been announced. Confirmed news will appear here and on our future official X account.</p></details>
      </div></div>
    </section>
  </main>

  <footer class="site-footer"><div class="wrap footer-inner"><a class="brand" href="#top">${mark}<span><b>ORE FRONTIER</b><small>AN INDEPENDENT MINING EXPEDITION</small></span></a><span>BUILT ONE CUT AT A TIME.</span><a href="${gameHref}">PLAY THE CURRENT BUILD ${arrow}</a><small>IN DEVELOPMENT</small></div></footer>
`;

document.querySelectorAll<HTMLDetailsElement>('.faq-list details').forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    document.querySelectorAll<HTMLDetailsElement>('.faq-list details').forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});
