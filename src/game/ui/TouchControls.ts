/** Touch input stays transient: it never changes the save or gameplay rules. */
export class TouchControls {
  readonly root = document.createElement('nav');
  private held = new Map<number, string>();
  private abort = new AbortController();
  private media = matchMedia('(any-pointer: coarse)');
  constructor(actions: Record<string, () => void>) {
    this.root.className = 'touch-controls';
    this.root.setAttribute('aria-label', 'Flight and mining controls');
    const hold = (key: string, label: string, text: string) =>
      `<button type="button" data-hold="${key}" aria-label="${label}">${text}</button>`;
    this.root.innerHTML = `<div class="touch-primary">${Object.keys(actions).filter(label => ['INTERACT', 'PLACE', 'CANCEL'].includes(label)).map(label => `<button type="button" data-action="${label}">${label}</button>`).join('')}<button type="button" data-tools aria-expanded="false" aria-controls="touch-equipment">Tools</button></div><div id="touch-equipment" class="touch-tools" hidden>${Object.keys(actions).filter(label => !['INTERACT', 'PLACE', 'CANCEL'].includes(label)).map(label => `<button type="button" data-action="${label}">${label}</button>`).join('')}${hold('R', 'Hold return winch', 'WINCH')}${hold('X', 'Hold stasis', 'STASIS')}${hold('G', 'Toggle grapple', 'GRAPPLE')}</div>
      <div class="touch-pad touch-flight"><span>MOVE / DRILL</span>${hold('W', 'W: thrust upward', 'W')}${hold('A', 'A: move or drill left', 'A')}${hold('S', 'S: drill down', 'S')}${hold('D', 'D: move or drill right', 'D')}</div>
      <small class="touch-rotate">Rotate for a wider view</small>`;
    document.querySelector('#viewport')!.append(this.root);
    const options = { signal: this.abort.signal };
    this.root.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-hold]');
      if (!button || this.root.hidden || button.disabled) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.held.set(event.pointerId, button.dataset.hold!);
      button.classList.add('held');
    }, options);
    this.root.addEventListener('pointermove', event => {
      if (!this.held.has(event.pointerId)) return;
      const pad = (event.target as HTMLElement).closest('.touch-pad');
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('[data-hold]');
      if (pad && target && pad.contains(target)) {
        this.held.set(event.pointerId, target.dataset.hold!);
        this.root.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(button =>
          button.classList.toggle('held', this.down(button.dataset.hold!)));
      }
    }, options);
    const release = (event: PointerEvent) => {
      this.held.delete(event.pointerId);
      this.root.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(button =>
        button.classList.toggle('held', this.down(button.dataset.hold!)));
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      this.root.addEventListener(type, release, options);
    this.root.addEventListener('click', event => {
      const toggle = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tools]');
      if (toggle) {
        const tray = this.root.querySelector<HTMLElement>('.touch-tools')!;
        tray.hidden = !tray.hidden;
        toggle.setAttribute('aria-expanded', String(!tray.hidden));
        this.clear();
        return;
      }
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (button && !this.root.hidden) { this.clear(); actions[button.dataset.action!]?.(); }
    }, options);
    window.addEventListener('blur', () => this.clear(), options);
    window.addEventListener('resize', () => this.clear(), options);
    document.addEventListener('visibilitychange', () => this.clear(), options);
    this.update(false);
  }
  down(key: string) { return [...this.held.values()].includes(key); }
  available(key: string, enabled: boolean, label?: string) {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-action="${key}"], [data-hold="${key}"]`);
    if (!button) return;
    if (button.hidden === enabled) button.hidden = !enabled;
    if (label && button.textContent !== label) button.textContent = label;
  }
  primary(key: string, promoted: boolean, label: string) {
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="' + key + '"]');
    if (!button) return;
    const parent = this.root.querySelector(promoted ? '.touch-primary' : '.touch-tools')!;
    if (button.parentElement !== parent) parent.prepend(button);
    if (button.textContent !== label) button.textContent = label;
  }
  clear() {
    this.held.clear();
    this.root.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
  }
  update(active: boolean) {
    const visible = this.media.matches && active;
    if (!visible) this.clear();
    if (this.root.hidden === visible) this.root.hidden = !visible;
  }
  destroy() { this.clear(); this.abort.abort(); this.root.remove(); }
}
