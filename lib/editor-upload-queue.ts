type QueueTask<T> = () => Promise<T>;

/**
 * Serializes editor uploads so the browser never exhausts its per-origin
 * connection pool (typically 6). Parallel presign + verify requests were
 * causing uploads 7+ to hang indefinitely after a server restart.
 */
class EditorUploadQueue {
  private active = false;
  private readonly waiting: Array<{
    task: QueueTask<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  enqueue<T>(task: QueueTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        task: task as QueueTask<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.pump();
    });
  }

  private async pump() {
    if (this.active || this.waiting.length === 0) return;

    const current = this.waiting.shift();
    if (!current) return;

    this.active = true;
    try {
      const result = await current.task();
      current.resolve(result);
    } catch (error) {
      current.reject(error);
    } finally {
      this.active = false;
      // Brief pause so the browser can recycle connections before the next upload.
      await sleep(250);
      void this.pump();
    }
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const editorUploadQueue = new EditorUploadQueue();

export const enqueueEditorUpload = <T>(task: QueueTask<T>) =>
  editorUploadQueue.enqueue(task);
