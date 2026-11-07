import { BatchController } from "./controller.js";
import { runBatch } from "./run-batch.js";
import type { BatchItemResult, BatchOptions, BatchTask } from "./types.js";

/**
 * A long-lived queue over runBatch: add items any time (before,
 * during, or after a run), pause/resume/cancel through the
 * queue's own controller, and `drain()` to await everything added
 * so far. Results accumulate in add order across waves.
 */
export class BatchQueue<TIn, TOut> {
  readonly controller: BatchController;
  private pendingItems: TIn[] = [];
  private readonly results: Array<BatchItemResult<TOut>> = [];
  private generation: Promise<void> | undefined;
  private waveCompleted = 0;
  private waveTotal = 0;

  constructor(
    private readonly task: BatchTask<TIn, TOut>,
    private readonly options: BatchOptions<TIn> = {},
  ) {
    this.controller =
      options.controller instanceof BatchController ? options.controller : new BatchController();
  }

  add(...items: TIn[]): this {
    this.pendingItems.push(...items);
    this.ensureRunning();
    return this;
  }

  pause(): void {
    this.controller.pause();
  }
  resume(): void {
    this.controller.resume();
  }
  cancel(): void {
    this.controller.abort();
  }

  /** Total items settled so far (across all waves). */
  get completedCount(): number {
    return this.results.length;
  }
  /** Items accepted but not yet settled (queued + in the active wave). */
  get pendingCount(): number {
    return this.pendingItems.length + (this.waveTotal - this.waveCompleted);
  }

  /** Resolves with every result so far once the queue is empty and idle. */
  async drain(): Promise<Array<BatchItemResult<TOut>>> {
    while (this.generation || this.pendingItems.length > 0) {
      if (!this.generation) this.ensureRunning();
      await this.generation;
    }
    return [...this.results];
  }

  private ensureRunning(): void {
    if (this.generation) return;
    this.generation = this.loop().finally(() => {
      this.generation = undefined;
      if (this.pendingItems.length > 0 && !this.controller.aborted) this.ensureRunning();
    });
  }

  private async loop(): Promise<void> {
    while (this.pendingItems.length > 0) {
      const wave = this.pendingItems.splice(0, this.pendingItems.length);
      const startIndex = this.results.length;
      this.waveCompleted = 0;
      this.waveTotal = wave.length;
      const waveResults = await runBatch(wave, this.task, {
        ...this.options,
        controller: this.controller,
        onProgress: (p) => {
          this.waveCompleted = p.completed;
          const priorSucceeded = this.results.filter((r) => r.status === "fulfilled").length;
          const priorFailed = this.results.length - priorSucceeded;
          this.options.onProgress?.({
            total: startIndex + p.total + this.pendingItems.length,
            completed: startIndex + p.completed,
            succeeded: priorSucceeded + p.succeeded,
            failed: priorFailed + p.failed,
            inFlight: p.inFlight,
          });
        },
      });
      for (const result of waveResults) {
        this.results.push({ ...result, index: startIndex + result.index });
      }
      if (this.controller.aborted) {
        this.pendingItems.length = 0;
        break;
      }
    }
  }
}
