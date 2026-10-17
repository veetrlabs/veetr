import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Read upstream as data only; publication always goes through the guarded importer. */
export async function syncBoatCatalog(env, fetcher = fetch) {
  const year = Number(env.BOAT_CATALOG_YEAR || 2024);
  if (!Number.isInteger(year) || year < 2019 || year > 2100)
    throw new Error("Invalid BOAT_CATALOG_YEAR");
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const readJson = async (url, options = {}) => {
    const response = await fetcher(url, {signal: AbortSignal.timeout(30000), ...options});
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    return response.json();
  };
  const source = await readJson(`${base}/rest/v1/boat_catalog_source?select=revision,year,sha256&singleton=eq.true`, {headers});
  if (!Array.isArray(source) || source.length > 1) throw new Error("Invalid installed catalog metadata");
  const installed = source[0];
  const commits = await readJson(`https://api.github.com/repos/jieter/orc-data/commits?path=ALL${year}.json&per_page=1`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(env.GITHUB_TOKEN ? {Authorization: `Bearer ${env.GITHUB_TOKEN}`} : {}) },
  });
  const revision = commits?.[0]?.sha;
  if (typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision))
    throw new Error("No valid upstream catalog commit found");
  if (installed?.year === year && installed.revision === revision)
    return {status:"unchanged", year, revision};
  // Ignore commits that leave the actual dataset unchanged (including initial
  // imports pinned to a later repository commit than the file's last change).
  const response = await fetcher(`https://raw.githubusercontent.com/jieter/orc-data/${revision}/ALL${year}.json`, {signal:AbortSignal.timeout(30000)});
  if (!response.ok || !response.body) throw new Error("Source download failed");
  const hash = createHash("sha256");
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000000) { await reader.cancel(); throw new Error("Source exceeds size limit"); }
    hash.update(value);
  }
  const sha256 = hash.digest("hex");
  if (installed?.year === year && installed.sha256 === sha256)
    return {status:"unchanged", year, revision, sha256};
  if (env.BOAT_CATALOG_CHECK_ONLY === "true") return {status:"update-available",year,revision,sha256};
  const imported = await readJson(`${base}/functions/v1/import-boat-catalog`, {
    method:"POST", headers, body:JSON.stringify({year,revision}), signal:AbortSignal.timeout(140000),
  });
  if (imported.revision !== revision || imported.year !== year || imported.sha256 !== sha256)
    throw new Error("Importer returned an unexpected source identity");
  return {status:"updated", ...imported};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await syncBoatCatalog(process.env),null,2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
