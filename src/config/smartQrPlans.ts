export type SmartQrPlanCode = "starter" | "growth" | "vip";
export type SmartQrMonthlyOption = "none" | "growth" | "vip";

export type SmartQrPlan = {
  code: SmartQrPlanCode;
  name: string;
  setupFeeInr: number;
  monthlyFeeInr: number;
  qrLimit: number;
  locationLimit: number;
  analyticsRetentionDays: number;
  features: string[];
};

export const SMART_QR_PLANS: Record<SmartQrPlanCode, SmartQrPlan> = {
  starter: {
    code: "starter", name: "Starter", setupFeeInr: 499, monthlyFeeInr: 0,
    qrLimit: 1, locationLimit: 1, analyticsRetentionDays: 7,
    features: ["Permanent shop destination", "Shop profile and contact links", "Basic scan count", "7-day analytics retention"],
  },
  growth: {
    code: "growth", name: "Growth", setupFeeInr: 999, monthlyFeeInr: 99,
    qrLimit: 1, locationLimit: 1, analyticsRetentionDays: 365,
    features: ["Everything in Starter", "Detailed scan and action analytics", "365-day analytics retention"],
  },
  vip: {
    code: "vip", name: "VIP Business", setupFeeInr: 1999, monthlyFeeInr: 199,
    qrLimit: 3, locationLimit: 3, analyticsRetentionDays: 730,
    features: ["Everything in Growth", "Up to 3 QR code records", "Up to 3 locations", "730-day analytics retention"],
  },
};

export const SMART_QR_MONTHLY_OPTIONS: Record<SmartQrPlanCode, ReadonlyArray<{
  value: SmartQrMonthlyOption;
  label: string;
  monthlyFeeInr: number;
}>> = {
  starter: [{ value: "none", label: "No monthly subscription", monthlyFeeInr: 0 }],
  growth: [
    { value: "none", label: "No monthly subscription", monthlyFeeInr: 0 },
    { value: "growth", label: "Growth monthly subscription — ₹99/month", monthlyFeeInr: 99 },
  ],
  vip: [
    { value: "none", label: "No monthly subscription", monthlyFeeInr: 0 },
    { value: "vip", label: "VIP monthly subscription — ₹199/month", monthlyFeeInr: 199 },
  ],
};

export function getSmartQrPlan(code: SmartQrPlanCode): SmartQrPlan {
  return SMART_QR_PLANS[code];
}

export function getSmartQrMonthlyOption(code: SmartQrPlanCode, option: SmartQrMonthlyOption) {
  return SMART_QR_MONTHLY_OPTIONS[code].find((item) => item.value === option) ?? SMART_QR_MONTHLY_OPTIONS[code][0];
}
