import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import './teaser.css';
import gameplayHero from './assets/teaser/gameplay-hero.png';
import workshopGameplay from './assets/teaser/workshop-gameplay.png';
import colonyGameplay from './assets/teaser/colony-gameplay.png';

const mark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 42 48"><path d="M4 3h34v42H4zM12 13h18M21 13v23m-8-8 8 8 8-8"/><circle cx="21" cy="23" r="3"/></svg></span>`;
const arrow = '<span aria-hidden="true">↗</span>';
const gameHref = import.meta.env.BASE_URL === '/' ? '/play' : import.meta.env.BASE_URL;
const publicGameplayVideoUrl = 'https://ikxfacubyvtelvcdeiba.supabase.co/storage/v1/object/public/ore-frontier-gameplay/ore-frontier-gameplay-beta.mp4';
const gameplayVideoUrl = import.meta.env.VITE_PUBLIC_GAMEPLAY_VIDEO_URL?.trim() || publicGameplayVideoUrl;

document.querySelector<HTMLDivElement>('#ore-frontier')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Ore Frontier home">${mark}<span><b>ORE FRONTIER</b><small>MINE · BUILD · EXPAND</small></span></a>
    <nav aria-label="Main navigation"><a href="#expedition">The game</a><a href="#token">Token</a><a href="#tokenomics">Tokenomics</a><a href="#roadmap">Roadmap</a><a href="#community">X / Community</a></nav>
    <a class="header-cta" href="${gameHref}">Play the current build ${arrow}</a>
  </header>

  <main id="top">
    <section class="hero wrap">
      <div class="hero-copy">
        <div class="eyebrow"><i></i> BROWSER MINING GAME · EARLY BUILD</div>
        <h1>Build your<br/><em>mining empire.</em></h1>
        <p class="hero-lede">Start with a miner and a mothership. Mine ore, build your first camp, and turn your haul into upgrades, automated extraction, and colonies across planets.</p>
        <div class="hero-actions"><a class="button button-primary" href="${gameHref}">Play the early build <span aria-hidden="true">→</span></a><a class="text-link" href="#first-look">Watch real gameplay <span aria-hidden="true">↓</span></a></div>
        <div class="control-hint"><span>W</span><span>A</span><span>S</span><span>D</span><small>MOVE &amp; DRILL</small><b>·</b><small>NO DOWNLOAD</small></div>
      </div>
      <figure class="hero-art"><img src="${gameplayHero}" alt="Screenshot from the Ore Frontier game: the miner drilling through ore underground, with cargo and rig status on screen"/><figcaption class="hero-caption"><i></i> ACTUAL GAMEPLAY · MINING IN PROGRESS</figcaption></figure>
    </section>

    <section class="ticker" aria-label="Game features"><div><span>MINE ORE</span><i>✳</i><span>UPGRADE YOUR RIG</span><i>✳</i><span>BUILD COLONIES</span><i>✳</i><span>AUTOMATE PRODUCTION</span><i>✳</i><span>MINE ORE</span></div></section>

    <section id="expedition" class="expedition wrap">
      <div class="section-kicker"><span>01 / BUILD YOUR OPERATION</span><span>FROM FIRST CAMP TO MULTIPLE PLANETS</span></div>
      <div class="expedition-heading"><h2>One miner.<br/><em>A growing operation.</em></h2><p>Your first copper and iron go into a mining camp. Build a market uplink to sell ore and unlock paid upgrades. Add storage and extractors, then take your mothership to another planet.</p></div>
      <div class="operation-steps">
        <article class="operation-step">
          <div class="operation-capture"><img src="${gameplayHero}" alt="Ore Frontier's miner cutting a tunnel through copper and iron deposits" loading="lazy" width="1280" height="720"/></div>
          <div class="operation-copy"><span class="operation-number">01 / MINING</span><h3>Mine ore.</h3><p>Drill your own tunnels. Keep ore for construction or sell it to fund your next upgrade.</p><span class="operation-detail">Copper · Iron · Silver · Gold &amp; more</span></div>
        </article>
        <article class="operation-step">
          <div class="operation-capture"><img src="${workshopGameplay}" alt="The actual Ore Frontier workshop showing drill, battery, cargo, hull and engine upgrades" loading="lazy" width="1440" height="900"/></div>
          <div class="operation-copy"><span class="operation-number">02 / WORKSHOP</span><h3>Upgrade your miner.</h3><p>Drill faster, carry more, and stay underground longer. Buy upgrades with the credits you earn from ore.</p><span class="operation-detail">Drill · Battery · Cargo · Hull · Engine</span></div>
        </article>
        <article class="operation-step">
          <div class="operation-capture"><img src="${colonyGameplay}" alt="Ore Frontier gameplay showing the mothership, miner, mining camp and market uplink on the planet surface" loading="lazy" width="1440" height="900"/></div>
          <div class="operation-copy"><span class="operation-number">03 / COLONY</span><h3>Build your colony.</h3><p>Start with a mining camp and market uplink. Add warehouses and automated extractors as your operation grows.</p><span class="operation-detail">Build · Store · Automate · Expand</span></div>
        </article>
      </div>
    </section>

    <section id="first-look" class="first-look">
      <div class="wrap first-look-inner">
        <div class="section-kicker"><span>02 / GAMEPLAY</span><span>CAPTURED IN THE CURRENT BUILD</span></div>
        <div class="first-look-layout">
          <div class="first-look-copy"><span class="eyebrow">ORE FRONTIER IN ACTION</span><h2>See the miner<br/><em>at work.</em></h2><p>Watch a short capture from the early build. Mining supplies the ore you use to build, upgrade, and expand your operation.</p><a class="button button-outline" href="${gameHref}">Play the current build <span aria-hidden="true">→</span></a><small class="media-note">30-SECOND GAMEPLAY PREVIEW · CURRENT BUILD</small></div>
          <figure class="gameplay-frame"><div class="frame-top"><span><i></i> GAMEPLAY / BETA PREVIEW</span><span>ORE FRONTIER&nbsp; · &nbsp;30 SEC</span></div>${gameplayVideoUrl ? `<video controls playsinline preload="metadata" poster="${gameplayHero}" aria-label="Ore Frontier 30-second gameplay preview"><source src="${gameplayVideoUrl}" type="video/mp4"/></video>` : `<div class="gameplay-video-pending" role="status"><span aria-hidden="true">▶</span><b>GAMEPLAY PREVIEW</b><small>PUBLIC VIDEO HOST COMING SOON</small></div>`}<figcaption><span>MINING GAMEPLAY</span><span>GAMEPLAY CAPTURE&nbsp; / &nbsp;CURRENT BUILD</span></figcaption></figure>
        </div>
      </div>
    </section>

    <section class="status-band"><div class="wrap status-content"><span class="status-dot"></span><div><small>PLAYABLE NOW · STILL IN DEVELOPMENT</small><p>Try mining, construction, upgrades, and planetary travel in the early build. The multiplayer beta is still being prepared.</p></div><a class="button button-primary" href="${gameHref}">Play Ore Frontier <span aria-hidden="true">→</span></a></div></section>

    <section id="token" class="launch-section wrap">
      <div class="section-kicker"><span>03 / CREDIT</span><span>PLANNED TOKEN · NOT IN THE GAME YET</span></div>
      <div class="launch-heading"><h2>CREDIT.<br/><em>Our ecosystem token.</em></h2><p>CREDIT is planned for the wider Srajtasma ecosystem, with Ore Frontier as its initial game branding. Its role in the game and across the ecosystem is still being defined.</p></div>
      <div class="utility-grid">
        <article><span class="feature-no">01 / THE GAME TODAY</span><h3>Mine, build, upgrade</h3><p>The current game uses ore and in-game credits to build your operation. These balances are separate from CREDIT.</p></article>
        <article><span class="feature-no">02 / THE PLAYER MARKET</span><h3>Trade ore with players</h3><p>A global buy-and-sell market is in development. Its initial tests use separate beta balances, with no connection to your campaign inventory or CREDIT.</p></article>
        <article><span class="feature-no">03 / THE TOKEN PLAN</span><h3>Connect the ecosystem</h3><p>The aim is to use CREDIT across ecosystem projects. Specific uses, conversion rules, and game integration will be announced when agreed.</p></article>
      </div>
    </section>

    <section id="tokenomics" class="tokenomics-band"><div class="wrap launch-section">
      <div class="section-kicker"><span>04 / CREDIT DETAILS</span><span>DETAILS TO BE ANNOUNCED</span></div>
      <div class="launch-heading"><h2>CREDIT.<br/><em>Launch details.</em></h2><p>CREDIT is the token name and ticker. Robinhood Chain is the chosen network, with CREDIT / WETH the intended trading pair. Contract and distribution details will be published before launch.</p></div>
      <dl class="token-facts"><div><dt>Token name &amp; ticker</dt><dd>CREDIT</dd></div><div><dt>Planned network</dt><dd>Robinhood Chain</dd></div><div><dt>Planned DEX pair</dt><dd>CREDIT / WETH</dd></div><div><dt>Contract address</dt><dd>TBA</dd></div><div><dt>Total supply &amp; allocation</dt><dd>TBA</dd></div><div><dt>Vesting &amp; unlocks</dt><dd>TBA</dd></div></dl>
      <p class="token-note">Allocation percentages, liquidity, emissions, and any burn or buyback mechanisms are unconfirmed. No sale or contract is linked from this page.</p>
    </div></section>

    <section id="roadmap" class="launch-section wrap">
      <div class="section-kicker"><span>05 / PRODUCT ROADMAP</span><span>DIRECTION, NOT FIXED DATES</span></div>
      <div class="launch-heading"><h2>Building toward<br/><em>multiplayer.</em></h2><p>The next release focuses on clear controls, reliable mining, and a basic global ore market. The early game, player market, and CREDIT integration are at different stages.</p></div>
      <ol class="roadmap-grid">
        <li><span class="phase-status">01 / AVAILABLE NOW</span><h3>Mining &amp; colony building</h3><p>Playable browser build with mining, ore collection, rig upgrades, colony building, and planetary travel.</p></li>
        <li><span class="phase-status">02 / NEXT · LAUNCH</span><h3>A smoother mining game</h3><p>Improve instructions, return navigation, mobile controls, and full-screen menus. Test the complete mine, build, sell, and upgrade loop.</p></li>
        <li><span class="phase-status">03 / IN DEVELOPMENT</span><h3>Global ore market</h3><p>Test player-to-player buy and sell orders with separate beta balances. Connecting the market to mined ore is a later step.</p></li>
        <li><span class="phase-status">04 / PLANNED</span><h3>CREDIT integration</h3><p>Publish the token model and define how CREDIT connects to the game and wider ecosystem. Integration timing is still to be confirmed.</p></li>
      </ol>
    </section>

    <section id="community" class="community-band"><div class="wrap community-inner"><div><span class="eyebrow">06 / DEVELOPMENT UPDATES</span><h2>Follow the build<br/><em>on X.</em></h2><p>Follow progress on mining, colonies, the global market, and CREDIT. We will add the official Ore Frontier X account here when it is ready.</p></div><div class="x-placeholder"><span aria-hidden="true" class="x-mark">𝕏</span><strong>Official X account</strong><span>COMING SOON</span><small>Account link to be announced</small></div></div></section>

    <section id="faq" class="faq wrap">
      <div class="section-kicker"><span>07 / FAQ</span><span>GETTING STARTED</span></div>
      <div class="faq-layout"><div><h2>About<br/><em>Ore Frontier.</em></h2><p>The game, the market, and CREDIT.</p></div><div class="faq-list">
        <details><summary>What is Ore Frontier?<span>+</span></summary><p>A browser game about building a mining empire. You mine ore, build camps and warehouses, upgrade your rig, add automated extractors, and expand to other planets.</p></details>
        <details><summary>Can I play it now?<span>+</span></summary><p>Yes. The current build is playable in your browser from the “Play” links on this page. It is still in development, so features and presentation will continue to change.</p></details>
        <details><summary>How do I control the miner?<span>+</span></summary><p>Use A/D or Left/Right to move, S/Down to drill down, and W/Up to fly up. Aim and hold the mouse button to drill toward ore. Press B to build. The game also has on-screen touch controls.</p></details>
        <details><summary>Can I play on my phone?<span>+</span></summary><p>The game has touch controls and responsive screens. Phone testing is ongoing; landscape is currently the best way to play.</p></details>
        <details><summary>Can I trade ore with other players?<span>+</span></summary><p>The global player market is in development. Its beta uses separate test balances. Ore mined in the campaign is not connected to that market yet.</p></details>
        <details><summary>Is CREDIT already in the game?<span>+</span></summary><p>No. The current game uses in-game credits. CREDIT is the planned ecosystem token; token integration and launch details are still to be announced.</p></details>
        <details><summary>When is the launch?<span>+</span></summary><p>The early build is playable now. Multiplayer beta and CREDIT launch dates have not been announced. Confirmed dates will be published here.</p></details>
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
