interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1Statement; }
interface Env { DB: D1Database; CF_PAGES_BRANCH?: string; }

const PREVIEW_BRANCH = "preview/d1-print-operations";
const DEMO_CUSTOMER_ID = "d1-preview-customer-0001";
const DEMO_ORDER_ID = "d1-preview-order-0001";
const DEMO_EVENT_ID = "d1-preview-event-0001";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
function previewOnly(env: Env) { return env.CF_PAGES_BRANCH === PREVIEW_BRANCH; }

export const onRequestGet = async ({ env }: { request: Request; env: Env }) => {
  if (!previewOnly(env)) return json({ error: "Not found" }, 404);
  try {
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM print_orders) AS print_orders,
        (SELECT COUNT(*) FROM print_customers) AS print_customers,
        (SELECT COUNT(*) FROM print_events) AS print_events,
        (SELECT COUNT(*) FROM email_delivery_log) AS email_delivery_log,
        (SELECT COUNT(*) FROM integration_events) AS integration_events
    `).first<Record<string, number>>();
    const demo = await env.DB.prepare(
      "SELECT id, tracking_code, order_status, payment_status FROM print_orders WHERE id = ?1"
    ).bind(DEMO_ORDER_ID).first<Record<string, string>>();
    return json({ connected: true, branch: PREVIEW_BRANCH, counts, demoOrder: demo ?? null });
  } catch {
    return json({ connected: false, error: "D1 preview query failed. Check the preview binding and schema." }, 503);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!previewOnly(env)) return json({ error: "Not found" }, 404);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ error: "JSON is required." }, 415);
  let body: { action?: string };
  try { body = await request.json() as { action?: string }; }
  catch { return json({ error: "Invalid JSON." }, 400); }

  try {
    if (body.action === "seed_demo") {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO print_customers
          (customer_id, full_name, mobile_e164, email, marketing_consent)
        VALUES (?1, ?2, ?3, NULL, 0)
      `).bind(DEMO_CUSTOMER_ID, "DEMO CUSTOMER - NOT REAL", "+910000000000").run();

      await env.DB.prepare(`
        INSERT OR IGNORE INTO print_orders
          (id, tracking_code, customer_name, customer_phone, service, file_key,
           file_name, file_size, mime_type, options_json, amount_paise,
           payment_status, order_status, customer_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, 'unpaid', 'awaiting_payment', ?11)
      `).bind(
        DEMO_ORDER_ID, "D1-DEMO-0001", "DEMO CUSTOMER - NOT REAL", "+910000000000",
        "Preview demonstration only", "preview-only/no-file", "sample-preview.pdf", 1024,
        "application/pdf", JSON.stringify({ previewOnly: true, noDocumentStored: true, noPaymentRequired: true }),
        DEMO_CUSTOMER_ID,
      ).run();

      await env.DB.prepare(`
        INSERT OR IGNORE INTO print_events
          (event_id, print_order_id, actor_type, event_type, details_json)
        VALUES (?1, ?2, 'system', 'preview_demo_created', ?3)
      `).bind(DEMO_EVENT_ID, DEMO_ORDER_ID, JSON.stringify({ previewOnly: true })).run();
      return json({ created: true, message: "Synthetic D1 demo record is ready. No real customer, file, payment or email was used." });
    }

    if (body.action === "mark_demo_printed") {
      const demo = await env.DB.prepare(
        "SELECT order_status FROM print_orders WHERE id = ?1"
      ).bind(DEMO_ORDER_ID).first<{ order_status: string }>();
      if (!demo) return json({ error: "Create the synthetic demo order first." }, 404);
      if (demo.order_status === "printed") return json({
        printed: true,
        cleanupEligible: true,
        simulatedOnly: true,
        message: "Demo is already marked Printed. Cleanup eligibility is recorded; no actual file exists or was deleted.",
      });
      await env.DB.prepare(
        "UPDATE print_orders SET order_status = 'printed' WHERE id = ?1"
      ).bind(DEMO_ORDER_ID).run();
      await env.DB.prepare(`
        INSERT INTO print_events
          (event_id, print_order_id, actor_type, event_type, details_json)
        VALUES (?1, ?2, 'admin', 'demo_printed_cleanup_eligible', ?3)
      `).bind(
        "d1-preview-printed-" + DEMO_ORDER_ID,
        DEMO_ORDER_ID,
        JSON.stringify({
          previewOnly: true,
          cleanupScope: "print-order-document-only",
          applicationDocumentsExcluded: true,
          fileDeletion: "not-executed-no-real-file",
          retained: ["tracking_code", "order_status", "payment_status", "event_history"],
        }),
      ).run();
      return json({
        printed: true,
        cleanupEligible: true,
        simulatedOnly: true,
        message: "Demo order marked Printed. Print-file cleanup eligibility was logged. This preview has no real file, so no cloud deletion was performed.",
      });
    }
    return json({ error: "Unsupported preview action." }, 400);
  } catch {
    return json({ created: false, error: "The preview action failed. Check the D1 schema and event history." }, 503);
  }
};
