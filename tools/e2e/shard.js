// Which browser-check files one CI shard runs (E2E_SHARD="1/2", set by the browser job's matrix). Shard 1 is this explicit
// list, the files that took about half the CI run in the 2026-11 timing; shard 2 is every other file, so a new test file
// lands in shard 2 and cannot silently drop out. With E2E_SHARD unset, every file runs.
export const SHARD_ONE = [
  'axe.test.js',
  'charts.test.js',
  'hospital.test.js',
  'hrrp-hospital.test.js',
  'hrrp-places.test.js',
  'hrrp-program.test.js',
  'interact.test.js',
];
export const SHARDS = 2;

export function shardFiles(files, env) {
  const set = env.E2E_SHARD?.trim();
  if (!set) return files;
  const m = /^([12])\/2$/.exec(set);
  if (!m) throw new RangeError(`E2E_SHARD must be "1/2" or "2/2", not ${JSON.stringify(env.E2E_SHARD)}`);
  const one = (f) => SHARD_ONE.includes(f.split('/').pop());
  return files.filter((f) => one(f) === (m[1] === '1'));
}
