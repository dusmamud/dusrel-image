/**
 * Worker runtime: a tiny RPC over postMessage (docs/ARCHITECTURE.md
 * section 3). Install the handler inside a dedicated worker:
 *
 *   import { installWorkerHandler } from '@dusrel/image-core';
 *   installWorkerHandler(self);
 *
 * Requests carry transferable-safe inputs (Blob or ArrayBuffer). Progress
 * and results are posted back with the same request id; errors cross the
 * boundary as typed codes, never raw exceptions.
 */
import { DusrelImageError } from "./errors.js";
import { processImage } from "./process.js";
import type { ProcessOptions, ProcessResult, ProgressStep } from "./types.js";

export type WorkerProcessOptions = Omit<ProcessOptions, "signal" | "onProgress">;

export interface WorkerProcessRequest {
  id: number;
  type: "process";
  input: Blob | ArrayBuffer;
  options?: WorkerProcessOptions;
}

export type WorkerProcessResponse =
  | { id: number; type: "result"; result: ProcessResult }
  | { id: number; type: "progress"; step: ProgressStep }
  | { id: number; type: "error"; code: string; message: string };

interface WorkerScopeLike {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<WorkerProcessRequest>) => void,
  ) => void;
  postMessage: (message: WorkerProcessResponse) => void;
}

export function installWorkerHandler(scope: WorkerScopeLike): void {
  scope.addEventListener("message", (event) => {
    const request = event.data;
    if (!request || request.type !== "process") return;
    const { id } = request;
    processImage(request.input, {
      ...(request.options ?? {}),
      onProgress: (step) => scope.postMessage({ id, type: "progress", step }),
    }).then(
      (result) => scope.postMessage({ id, type: "result", result }),
      (cause: unknown) => {
        if (cause instanceof DusrelImageError) {
          scope.postMessage({ id, type: "error", code: cause.code, message: cause.message });
        } else {
          scope.postMessage({
            id,
            type: "error",
            code: "encode-failed",
            message: cause instanceof Error ? cause.message : "Unknown worker error.",
          });
        }
      },
    );
  });
}
