const KEY = "gene_profile_library_v1";

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

export function listProfiles() {
  return readAll();
}

export function saveProfile(profile) {
  const all = readAll();
  const now = new Date().toISOString();
  const name = profile.name?.trim();
  if (!name) throw new Error("Profile needs a name.");

  const idx = all.findIndex((p) => p.name === name);
  const record = {
    id: name,
    name,
    profile,
    updatedAtISO: now,
    createdAtISO: idx >= 0 ? all[idx].createdAtISO : now
  };

  if (idx >= 0) all[idx] = record;
  else all.unshift(record);

  writeAll(all);
  return record;
}

export function deleteProfile(name) {
  const all = readAll().filter((p) => p.name !== name);
  writeAll(all);
}

export function getProfile(name) {
  return readAll().find((p) => p.name === name) || null;
}
