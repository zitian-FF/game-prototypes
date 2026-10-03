import type { QuotaStatus } from 'firestorm-net';
import { serverBase } from './session';

/** The server's estimate of how many matches today's limits still allow, for the landing page. */
export class QuotaWatcher {
  status: QuotaStatus | null = null;
  failed = false;
  private timer: number | undefined;

  start(): void {
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 30_000);
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch(`${serverBase().replace(/^ws/, 'http')}/api/quota`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      this.status = (await res.json()) as QuotaStatus;
      this.failed = false;
    } catch {
      this.failed = true;
    }
  }
}
