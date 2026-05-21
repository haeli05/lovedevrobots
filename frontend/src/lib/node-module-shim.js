// Browser shim for Node.js built-in 'module'.
// @mujoco/mujoco conditionally imports this to build a require() function,
// but webpack/turbopack already provide require in bundled output so this
// code path never actually runs — we just need the import to resolve.
export function createRequire() {
  return function require() {
    throw new Error('require not available in browser');
  };
}
export const builtinModules = [];
export default { createRequire, builtinModules };
