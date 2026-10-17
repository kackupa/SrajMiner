/** Long reference screens stay reachable without nested scrollbar chrome. */
export function panelPages(root: HTMLElement) {
  if (root.querySelector('.star-map-screen')) return () => {};
  const panel = root.querySelector<HTMLElement>('.camp-main') ?? root.querySelector<HTMLElement>('.modal');
  if (!panel) return () => {};
  const nav = document.createElement('nav');
  nav.className = 'panel-pages';
  nav.setAttribute('aria-label', 'Panel pages');
  nav.innerHTML = '<button aria-label="Previous page">← Previous</button><span></span><button aria-label="Next page">Next →</button>';
  root.querySelector('.modal')!.append(nav);
  const [previous, next] = Array.from(nav.querySelectorAll('button')); 
  const update = () => {
    const overflow = panel.scrollHeight - panel.clientHeight;
    const step = Math.max(1, panel.clientHeight - 48);
    const total = 1 + Math.ceil(Math.max(0, overflow) / step);
    nav.hidden = overflow < 4;
    previous.disabled = panel.scrollTop < 2;
    next.disabled = panel.scrollTop >= overflow - 2;
    nav.querySelector('span')!.textContent = `${next.disabled ? total : 1 + Math.floor(panel.scrollTop / step)} / ${total}`;
  };
  previous.onclick = () => panel.scrollBy({ top: -panel.clientHeight + 48 });
  next.onclick = () => panel.scrollBy({ top: panel.clientHeight - 48 });
  panel.addEventListener('scroll', update);
  const observer = new ResizeObserver(update);
  observer.observe(panel);
  panel.querySelectorAll<HTMLElement>('.intro-screen, .camp-content, .camp-heading, .pause-menu, .pause-rig')
    .forEach(content => observer.observe(content));
  update();
  return () => { observer.disconnect(); panel.removeEventListener('scroll', update); nav.remove(); };
}
