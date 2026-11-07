import type { BatchControllerLike } from "./types.js";

/**
 * Pause/resume/cancel control for a batch run. Pass it as
 * `options.controller`; the same controller can drive a
 * BatchQueue. Pausing stops NEW items from starting (in-flight
 * items finish); aborting cancels everything pending.
 */
export class BatchController implements BatchControllerLike {
  private readonly abortController = new AbortController();
  private listeners = new Set<() => void>();
  private isPaused = false;

  get paused(): boolean {
    return this.isPaused;
  }
  get signal(): AbortSignal {
    return this.abortController.signal;
  }
  get aborted(): boolean {
    return this.abortController.signal.aborted;
  }

  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.emit();
  }
  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.emit();
  }
  abort(reason?: unknown): void {
    this.abortController.abort(reason);
    this.emit();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
