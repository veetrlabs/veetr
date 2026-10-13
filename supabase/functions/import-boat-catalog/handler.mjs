import { parseCatalogRecords, normalizeCatalog } from "./catalog.mjs";
export const DEFAULT_REVISION = "c2ca870c6b22cc02c25afd5bac0f2d8297bf95de";
export function createCatalogImportHandler(env, fetcher = fetch) {
  return async (req) => {
    if (req.method !== "POST")
      return Response.json({ error: "POST required" }, { status: 405 });
    // Manual/admin only. Never accept a user's JWT or a publishable/anon key.
    if (
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      req.headers.get("authorization") !==
        `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    )
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const body = await req.json(),
        year = body.year ?? 2024,
        revision = body.revision ?? DEFAULT_REVISION;
      if (
        !Number.isInteger(year) ||
        year < 2019 ||
        year > 2100 ||
        !/^[a-f0-9]{40}$/.test(revision)
      )
        throw new Error("Use a year and a full Git commit SHA");
      const sourceUrl = `https://raw.githubusercontent.com/jieter/orc-data/${revision}/ALL${year}.json`;
      const response = await fetcher(sourceUrl, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("Source download failed");
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16000000) {
          await reader.cancel();
          throw new Error("Source exceeds size limit");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const runId = crypto.randomUUID();
      let count = 0,
        skipped = 0,
        index = 0;
      const countries = new Set();
      const rpc = async (name, args) => {
        const result = await fetcher(
          `${env.SUPABASE_URL}/rest/v1/rpc/${name}`,
          {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!result.ok) {
          const error = await result.json().catch(() => ({}));
          throw new Error(error.message ?? "Catalog publication failed");
        }
        return result.json();
      };
      const stage = async (batch) => {
        const normalized = normalizeCatalog(batch, year, {
          partial: true,
          offset: index,
        });
        index += batch.length;
        count += normalized.rows.length;
        skipped += normalized.skipped;
        normalized.countryNames.forEach((c) => countries.add(c));
        if (normalized.rows.length)
          await rpc("stage_boat_catalog", {
            p_run_id: runId,
            p_rows: normalized.rows,
          });
      };
      let batch = [];
      for (const row of parseCatalogRecords(new TextDecoder().decode(bytes))) {
        batch.push(row);
        if (index + batch.length > 30000)
          throw new Error("Invalid catalog size");
        if (batch.length === 100) {
          await stage(batch);
          batch = [];
        }
      }
      if (batch.length) await stage(batch);
      if (count < 1000 || countries.size < 10 || skipped > index * 0.1)
        throw new Error("Incomplete catalog; existing catalog was not changed");
      const published = await rpc("install_boat_catalog", {
        p_run_id: runId,
        p_revision: revision,
        p_year: year,
        p_source_url: sourceUrl,
        p_sha256: digest,
      });
      return Response.json({
        count: published,
        skipped,
        countries: countries.size,
        revision,
        year,
        sha256: digest,
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Import failed" },
        { status: 400 },
      );
    }
  };
}
