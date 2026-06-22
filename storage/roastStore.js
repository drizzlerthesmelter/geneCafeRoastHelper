const KEY = "gene_roast_history_v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function writeAll(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (err) {
    throw new Error("Storage unavailable. Check privacy settings or run via http://");
  }
}

export function saveRoast(record) {
  const all = readAll();
  all.unshift(record);
  writeAll(all);
}

export function updateRoast(id, updater) {
  const all = readAll();
  const index = all.findIndex((r) => r.id === id);
  if (index < 0) return null;

  const next = typeof updater === "function"
    ? updater(all[index])
    : { ...all[index], ...updater };
  all[index] = next;
  writeAll(all);
  return next;
}

export function listRoasts() {
  return readAll();
}

export function deleteRoast(id) {
  const all = readAll().filter((r) => r.id !== id);
  writeAll(all);
}

export function clearRoasts() {
  writeAll([]);
}
