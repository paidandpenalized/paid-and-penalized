// How many browser-check files run at once (run.js), and how many tests a describe runs at once in each (lib.js
// CONCURRENCY): E2E_CONCURRENCY when it is set (CI sets 1), else one fewer than the machine's cores, up to four. The two
// multiply: on a machine with few cores, several files each loading several of the heaviest pages at once time out
// (seen on a 2-core runner with two at a time, and on GitHub's 4-core runner for public repositories with three files of
// three tabs), so CI pins both to one, a load it is known to carry.
export function e2eConcurrency(env, cores) {
  const set = env.E2E_CONCURRENCY?.trim();
  if (set) {
    const n = Number(set);
    if (!Number.isInteger(n) || n < 1) throw new RangeError(`E2E_CONCURRENCY must be a whole number of 1 or more, not ${JSON.stringify(env.E2E_CONCURRENCY)}`);
    return n;
  }
  return Math.max(1, Math.min(4, cores - 1));
}
