import type { User } from '@supabase/supabase-js';
import { consumeOnlineSignInError, onlineAuthClient, sendOnlineSignInLink, signOutOnline, verifiedAccount } from '../online/AuthClient';
import { downloadLocalBackup, listLocalBackups, listRecentLocalBackups, uploadLocalBackup, type BackupSummary } from '../online/BackupApi';
import { prepareLocalBackup, restoreLocalBackup, type PreparedLocalBackup } from '../online/LocalBackup';
import { startVerifiedCampaign } from '../online/VerifiedGameApi';
import { VerifiedMiningPanel } from './VerifiedMiningPanel';

type PendingUpload = { ownerId: string; backup: PreparedLocalBackup; revision: number; operationId: string };

// Account panels are rebuilt during navigation. Keep an uncertain upload's
// operation ID in memory so reopening the panel cannot issue a duplicate save.
let pendingUpload: PendingUpload | null = null;
let pendingStart: { ownerId: string; operationId: string } | null = null;

/** Account storage never changes the playable Local campaign until Restore is confirmed. */
export class AccountPanel {
  private user: User | null = null;
  private loading = false;
  private busy = false;
  private notice = '';
  private backups: BackupSummary[] = [];
  private page = 0;
  private view: 'campaigns' | 'backups' = 'campaigns';
  private restoreIndex: number | null = null;
  private generation = 0;
  private verifiedPanel: VerifiedMiningPanel | null = null;
  private readonly onResize = () => {
    if (this.verifiedPanel) return;
    const pageSize = matchMedia('(max-height: 650px)').matches ? 1 : 3;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(this.backups.length / pageSize) - 1));
    this.render();
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly back: () => void,
    private readonly saveLocal: () => boolean,
  ) {}

  async open(): Promise<void> {
    const generation = ++this.generation;
    const callbackNotice = consumeOnlineSignInError();
    window.addEventListener('resize', this.onResize);
    this.loading = true;
    this.notice = callbackNotice ?? '';
    this.render();
    try {
      const user = await verifiedAccount();
      if (generation !== this.generation) return;
      this.user = user;
      if (pendingUpload && pendingUpload.ownerId !== user?.id) pendingUpload = null;
      if (pendingStart && pendingStart.ownerId !== user?.id) pendingStart = null;
      this.loading = false;
      this.render();
    } catch {
      if (generation !== this.generation) return;
      this.user = null;
      this.loading = false;
      this.notice = 'Sign-in could not be checked. Check your connection and try again.';
      this.render();
    }
  }

  close(): void {
    this.generation++;
    this.verifiedPanel?.close();
    this.verifiedPanel = null;
    window.removeEventListener('resize', this.onResize);
  }

  private render(): void {
    if (this.verifiedPanel) return;
    const configured = !!onlineAuthClient();
    const verifiedEnabled = import.meta.env.VITE_VERIFIED_GAME_ENABLED === 'true';
    const pageSize = matchMedia('(max-height: 650px)').matches ? 1 : 3;
    const items = this.backups.slice(this.page * pageSize, this.page * pageSize + pageSize);
    const totalPages = Math.max(1, Math.ceil(this.backups.length / pageSize));
    const body = !configured
      ? '<p>Account backup is unavailable in this build. Your Local campaign remains playable and saved in this browser.</p>'
      : this.loading
        ? '<p>Checking your account...</p>'
        : !this.user
          ? `<p>Sign in by email to keep a separate copy of your Local campaign. Existing ore and Kredits stay Local and cannot enter the Player Exchange.</p>
             <form id="account-sign-in"><label for="account-email">Email address</label><input id="account-email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"><button class="primary" type="submit" ${this.busy ? 'disabled' : ''}>SEND SIGN-IN LINK <span>↗</span></button></form>`
          : this.restoreIndex !== null
            ? `<p>Replace the Local campaign in this browser with backup revision ${this.backups[this.restoreIndex].revision}? A safety copy of the current save will be kept here. This does not add ore or Kredits to Verified Online.</p>
               <div class="account-actions"><button class="primary danger" id="account-confirm-restore" ${this.busy ? 'disabled' : ''}>RESTORE LOCAL BACKUP</button><button id="account-cancel-restore" ${this.busy ? 'disabled' : ''}>CANCEL</button></div>`
            : this.view === 'backups'
              ? `<div class="account-backups"><div class="account-row"><b>LOCAL BACKUPS</b><button id="account-refresh" ${this.busy ? 'disabled' : ''}>REFRESH</button></div>
                 ${items.length ? items.map((item, index) => `<div class="account-backup"><span>REVISION ${item.revision}<small>${new Date(item.created_at).toLocaleString()}</small></span><button data-account-restore="${this.page * pageSize + index}" ${this.busy ? 'disabled' : ''}>RESTORE</button></div>`).join('') : '<p>No cloud backups loaded.</p>'}
                 ${this.backups.length > pageSize ? `<div class="account-pages"><button id="account-prev" ${this.page === 0 ? 'disabled' : ''}>PREVIOUS</button><span>${this.page + 1} / ${totalPages}</span><button id="account-next" ${this.page + 1 >= totalPages ? 'disabled' : ''}>NEXT</button></div>` : ''}</div>
                 <button id="account-campaigns">BACK TO CAMPAIGNS</button>`
              : `<div class="account-choices"><div class="account-card"><b>LOCAL CAMPAIGN</b><p>Keep playing this save. Account backups never become tradable ore or Kredits.</p><button class="primary" id="account-backup" ${this.busy ? 'disabled' : ''}>${pendingUpload ? 'RETRY BACKUP' : 'BACK UP THIS CAMPAIGN'} <span>↗</span></button></div>
                 <div class="account-card"><b>VERIFIED ONLINE</b><p>${verifiedEnabled ? 'Separate zero-asset start. Server-confirmed mining preview; other Online actions are still being built.' : 'Separate start with server-issued zero ore and Kredits. Gameplay is still being built.'}</p><button id="account-start-verified" ${this.busy || !verifiedEnabled ? 'disabled' : ''}>${verifiedEnabled ? 'START VERIFIED MINING' : 'START UNAVAILABLE'}</button></div></div>
                 <div class="account-actions"><button id="account-show-backups">VIEW LOCAL BACKUPS</button><button id="account-sign-out" ${this.busy ? 'disabled' : ''}>SIGN OUT</button></div>`;
    this.host.innerHTML = `<section class="modal account-modal" role="dialog" aria-modal="true" aria-label="Account and campaigns">
      <button class="close" id="account-back" aria-label="Back to game">×</button><div class="eyebrow">ORE FRONTIER / ACCOUNT</div><h2>Choose your campaign.</h2>
      ${this.user && !this.loading ? '<p class="account-state">SIGNED IN · LOCAL CAMPAIGN</p>' : ''}${body}
      <p class="account-notice" role="status"></p></section>`;
    this.host.querySelector<HTMLElement>('.account-notice')!.textContent = this.notice;
    this.host.querySelector<HTMLButtonElement>('#account-back')!.onclick = this.back;
    const form = this.host.querySelector<HTMLFormElement>('#account-sign-in');
    if (form) form.onsubmit = event => { event.preventDefault(); void this.sendLink(); };
    this.host.querySelector<HTMLButtonElement>('#account-backup')?.addEventListener('click', () => void this.backup());
    this.host.querySelector<HTMLButtonElement>('#account-start-verified')?.addEventListener('click', () => void this.startVerified());
    this.host.querySelector<HTMLButtonElement>('#account-refresh')?.addEventListener('click', () => void this.refreshBackups());
    this.host.querySelector<HTMLButtonElement>('#account-show-backups')?.addEventListener('click', () => { this.view = 'backups'; void this.refreshBackups(); });
    this.host.querySelector<HTMLButtonElement>('#account-campaigns')?.addEventListener('click', () => { this.view = 'campaigns'; this.render(); });
    this.host.querySelector<HTMLButtonElement>('#account-prev')?.addEventListener('click', () => { this.page--; this.render(); });
    this.host.querySelector<HTMLButtonElement>('#account-next')?.addEventListener('click', () => { this.page++; this.render(); });
    this.host.querySelector<HTMLButtonElement>('#account-sign-out')?.addEventListener('click', () => void this.signOut());
    this.host.querySelector<HTMLButtonElement>('#account-cancel-restore')?.addEventListener('click', () => { this.restoreIndex = null; this.render(); });
    this.host.querySelector<HTMLButtonElement>('#account-confirm-restore')?.addEventListener('click', () => void this.restore());
    this.host.querySelectorAll<HTMLButtonElement>('[data-account-restore]').forEach(button => button.onclick = () => {
      this.restoreIndex = Number(button.dataset.accountRestore);
      this.render();
    });
  }

  private async sendLink(): Promise<void> {
    const input = this.host.querySelector<HTMLInputElement>('#account-email');
    if (!input?.reportValidity() || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    const email = input.value;
    this.notice = '';
    try {
      await sendOnlineSignInLink(email);
      this.notice = 'Check your email for the sign-in link, then return to Account.';
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'Sign-in link could not be sent.';
    } finally {
      if (generation === this.generation) { this.busy = false; this.render(); }
    }
  }

  private async backup(): Promise<void> {
    if (this.busy || !this.user) return;
    const generation = this.generation;
    this.busy = true;
    this.notice = '';
    this.render();
    try {
      if (!pendingUpload) {
        if (!this.saveLocal()) throw new Error('Local save failed. The backup was not sent.');
        const backup = prepareLocalBackup(localStorage);
        if (!backup) throw new Error('No valid Local campaign is available to back up.');
        const latest = await listLocalBackups(backup.campaign_id);
        pendingUpload = { ownerId: this.user.id, backup, revision: latest[0]?.revision ?? 0, operationId: crypto.randomUUID() };
      }
      const pending = pendingUpload;
      const result = await uploadLocalBackup(pending.backup, pending.revision, pending.operationId);
      pendingUpload = null;
      this.notice = `Local backup saved as revision ${result.revision}.`;
      try {
        await this.loadBackups();
      } catch {
        this.notice += ' The backup list could not refresh; use View Local Backups to try again.';
      }
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'Backup failed. Retry with the same request.';
    } finally {
      if (generation === this.generation) { this.busy = false; this.render(); }
    }
  }

  private async loadBackups(): Promise<void> {
    this.backups = await listRecentLocalBackups();
    const pageSize = matchMedia('(max-height: 650px)').matches ? 1 : 3;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(this.backups.length / pageSize) - 1));
  }

  private async refreshBackups(): Promise<void> {
    if (this.busy || !this.user) return;
    const generation = this.generation;
    this.busy = true;
    this.notice = '';
    try {
      await this.loadBackups();
      this.notice = 'Backup list refreshed.';
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'Backups could not be loaded.';
    } finally {
      if (generation === this.generation) { this.busy = false; this.render(); }
    }
  }

  private async restore(): Promise<void> {
    const item = this.restoreIndex === null ? null : this.backups[this.restoreIndex];
    if (!item || this.busy || !this.user) return;
    const generation = this.generation;
    this.busy = true;
    this.notice = 'Loading and validating the Local backup...';
    this.render();
    try {
      const save = await downloadLocalBackup(item.campaign_id, item.id);
      if (generation !== this.generation) return;
      const result = restoreLocalBackup(localStorage, save, item.campaign_id);
      if (!result.restored) throw new Error('Local restore failed. The current save was retained.');
      location.reload();
    } catch (error) {
      if (generation !== this.generation) return;
      this.notice = error instanceof Error ? error.message : 'Local backup could not be restored.';
      this.busy = false;
      this.render();
    }
  }

  private async signOut(): Promise<void> {
    if (this.busy) return;
    const generation = this.generation;
    this.busy = true;
    try {
      await signOutOnline();
      this.user = null;
      this.backups = [];
      pendingUpload = null;
      this.notice = 'Signed out. Your Local campaign is still here.';
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'Sign-out failed.';
    } finally {
      if (generation === this.generation) { this.busy = false; this.render(); }
    }
  }

  private async startVerified(): Promise<void> {
    if (this.busy || !this.user || import.meta.env.VITE_VERIFIED_GAME_ENABLED !== 'true') return;
    const generation = this.generation;
    this.busy = true;
    this.notice = 'Starting your separate Verified Online campaign...';
    this.render();
    try {
      if (!pendingStart) pendingStart = { ownerId: this.user.id, operationId: crypto.randomUUID() };
      const start = await startVerifiedCampaign(pendingStart.operationId);
      if (generation !== this.generation) return;
      pendingStart = null;
      this.verifiedPanel = new VerifiedMiningPanel(this.host, () => {
        this.verifiedPanel?.close();
        this.verifiedPanel = null;
        this.render();
      });
      await this.verifiedPanel.open(start.campaign_id);
    } catch (error) {
      if (generation !== this.generation) return;
      this.notice = error instanceof Error ? error.message : 'Online start failed; retry the same request.';
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.render();
      }
    }
  }
}
