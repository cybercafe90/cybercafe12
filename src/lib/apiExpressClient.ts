import { supabase } from "./supabase";

export type ApiExpressService =
  | "kyc_pan"
  | "kyc_aadhaar_dl"
  | "rc_verify"
  | "bank_verify"
  | "telecom_operator"
  | "mobile_recharge"
  | "fuel_price"
  | "commodity_price"
  | "weather"
  | "air_quality"
  | "security_risk";

export type ApiExpressResult<T = unknown> = {
  ok: boolean;
  service: ApiExpressService | "admin_logs";
  data?: T;
  error?: string;
  cached?: boolean;
};

const FUNCTION_NAME = "api-express-gateway";

export async function callApiExpress<T = unknown>(
  service: ApiExpressService,
  payload: Record<string, unknown>,
): Promise<ApiExpressResult<T>> {
  if (!supabase) {
    return { ok: false, service, error: "Secure API service is not configured." };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) {
    return { ok: false, service, error: "Please sign in before using this verification service." };
  }

  try {
    const { data, error } = await supabase.functions.invoke<ApiExpressResult<T>>(
      FUNCTION_NAME,
      {
        body: { service, payload },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (error) {
      return { ok: false, service, error: "Verification service is temporarily unavailable." };
    }
    if (!data || typeof data.ok !== "boolean") {
      return { ok: false, service, error: "The verification service returned an invalid response." };
    }
    return data;
  } catch {
    return { ok: false, service, error: "Could not connect to the verification service." };
  }
}

export async function getApiExpressLogs(limit = 50) {
  if (!supabase) throw new Error("Secure API service is not configured.");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Owner sign-in required.");

  const { data, error } = await supabase.functions.invoke<ApiExpressResult<{
    items: Array<{
      id: number;
      user_id: string;
      service_name: string;
      status: string;
      http_code: number;
      created_at: string;
    }>;
    counts: { total: number; success: number; errors: number; cache_hits: number };
  }>>(FUNCTION_NAME, {
    body: { service: "admin_logs", payload: { limit } },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error || !data?.ok || !data.data) {
    throw new Error(data?.error ?? "API Express logs could not be loaded.");
  }
  return data.data;
}
