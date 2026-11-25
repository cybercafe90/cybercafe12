import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({ error: "This assistant endpoint has been retired. The website now uses its built-in local service assistant." }),
  { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
));
