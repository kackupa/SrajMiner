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
    this.root.innerHTML = `<div class="touch-tools">${Object.keys(actions).map(label => `<button type="button" data-action="${label}">${label}</button>`).join('')}${hold('R', 'Hold return winch', 'WINCH')}${hold('X', 'Hold stasis', 'STASIS')}${hold('G', 'Toggle grapple', 'GRAPPLE')}</div>
      <div class="touch-pad touch-flight"><span>MOVE / THRUST</span>${hold('W', 'Thrust upward', '↑')}${hold('A', 'Move left', '←')}${hold('D', 'Move right', '→')}</div>
      <div class="touch-pad touch-drill"><span>HOLD TO DRILL</span>${hold('S', 'Drill down', '↓')}${hold('A', 'Drill left', '←')}${hold('D', 'Drill right', '→')}</div>
      <small class="touch-rotate">Rotate for a wider view</small>`;
    document.querySelector('#viewport')!.append(this.root);
    const options = { signal: this.abort.signal };
    this.root.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-hold]');
      if (!button || this.root.hidden) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.held.set(event.pointerId, button.dataset.hold!);
      button.classList.add('held');
    }, options);
    const release = (event: PointerEvent) => {
      this.held.delete(event.pointerId);
      this.root.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(button =>
        button.classList.toggle('held', this.down(button.dataset.hold!)));
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      this.root.addEventListener(type, release, options);
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (button && !this.root.hidden) actions[button.dataset.action!]?.();
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
    button.hidden = !enabled;
    if (label && button.textContent !== label) button.textContent = label;
  }
  clear() {
    this.held.clear();
    this.root.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
  }
  update(active: boolean) {
    const visible = this.media.matches && active;
    if (!visible) this.clear();
    this.root.hidden = !visible;
  }
  destroy() { this.clear(); this.abort.abort(); this.root.remove(); }
}
