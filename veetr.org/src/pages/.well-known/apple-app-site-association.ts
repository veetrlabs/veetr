export function GET() {
  return new Response(
    JSON.stringify({
      applinks: {
        details: [
          {
            appIDs: ["3Z496JB962.com.veetr.mobile"],
            components: [{ "/": "/join/*" }],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
