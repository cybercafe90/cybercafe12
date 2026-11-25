const allowedOrigins = ["https://babacybercafe.in", "https://www.babacybercafe.in"];
Deno.serve((req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins.includes(origin) || (origin.startsWith("https://") && origin.endsWith(".babacybercafe.pages.dev"));
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowed && origin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ error: "This endpoint has been permanently retired." }), { status: 410, headers });
});