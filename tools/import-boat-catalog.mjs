// Manual operator command. Credentials come from environment, never command-line arguments.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const [year, revision] = process.argv.slice(2);
const response = await fetch(
  `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/import-boat-catalog`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(year ? { year: Number(year) } : {}),
      ...(revision ? { revision } : {}),
    }),
    signal: AbortSignal.timeout(140000),
  },
);
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
