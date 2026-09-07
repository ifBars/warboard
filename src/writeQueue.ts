/** Keep the latest value for each key while a previous storage transaction runs. */
export function createWriteQueue<T>(
  write: (values: Map<string, T>, latest: T) => Promise<void>,
) {
  let pending = new Map<string, T>();
  let latest: T;
  let waiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  let running = false,
    failed = false,
    lastError: unknown;
  let completion = Promise.resolve();
  async function drain() {
    while (pending.size) {
      const batch = pending,
        jobs = waiters,
        active = latest;
      pending = new Map();
      waiters = [];
      try {
        await write(batch, active);
        failed = false;
        jobs.forEach((job) => job.resolve());
      } catch (error) {
        failed = true;
        lastError = error;
        jobs.forEach((job) => job.reject(error));
      }
    }
    running = false;
  }
  return {
    save(key: string, value: T) {
      pending.set(key, value);
      latest = value;
      const result = new Promise<void>((resolve, reject) =>
        waiters.push({ resolve, reject }),
      );
      if (!running) {
        running = true;
        completion = drain();
      }
      return result;
    },
    async flush() {
      await completion;
      if (failed) throw lastError;
    },
    dirty: () => running || failed,
  };
}
