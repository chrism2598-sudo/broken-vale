/**
 * M55 · diagnostics build only (dead code in production, where __DIAG__ is false): the diag build may READ the player's
 * save (to load the same world state) but can never write, replace or delete anything in localStorage. Installed before
 * any other game module runs; every blocked attempt is recorded in window.__diagBlocked for the smoke test.
 */
if (__DIAG__) {
  const blocked: string[] = []; (window as unknown as { __diagBlocked: string[] }).__diagBlocked = blocked;
  const P = Storage.prototype;
  P.setItem = function (k: string) { blocked.push('set:' + k); };
  P.removeItem = function (k: string) { blocked.push('del:' + k); };
  P.clear = function () { blocked.push('clear'); };
}
export {};
