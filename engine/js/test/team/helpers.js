// Shared by the TEAM engine tests.
import assert from 'node:assert/strict';

// near(a, b, tol): a is within an absolute tol of b. makeNear sets the default tolerance for a file that wants another.
export const makeNear = (defaultTol) => (a, b, tol = defaultTol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
export const near = makeNear(1e-9);
