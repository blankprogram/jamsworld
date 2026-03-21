const isPlainObject = (v) =>
  v != null && typeof v === "object" && v.constructor === Object;

function deepEqual(a, b) {
  if (a === b) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i += 1) {
      const key = ak[i];
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

export function diffKeys(prev = {}, next = {}) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = [];
  for (const key of keys) {
    if (!deepEqual(prev[key], next[key])) changed.push(key);
  }
  return changed;
}

export function applyPassOptions(pass, changedKeys, opts, context = "") {
  if (!pass?.setOption || !Array.isArray(changedKeys) || !changedKeys.length) return;

  for (let i = 0; i < changedKeys.length; i += 1) {
    const key = changedKeys[i];
    try {
      pass.setOption(key, opts[key]);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        const passName = pass?.constructor?.name || "UnknownPass";
        const prefix = context ? `[${context}] ` : "";
        // Expose option wiring bugs during development without breaking runtime.
        console.warn(
          `${prefix}${passName} failed to apply option "${key}"`,
          err,
        );
      }
    }
  }
}
