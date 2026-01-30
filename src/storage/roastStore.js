const KEY = "gene_roast_history_v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function writeAll(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function saveRoast(record) {
  const all = readAll();
  all.unshift(record);
  writeAll(all);
}

export function listRoasts() {
  return readAll();
}
