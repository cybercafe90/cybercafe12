export function customerInstantTpRecord(row: Record<string, unknown>, policyUrl: string | null = null) {
  return {
    trackingId: row.tracking_id,
    customerName: row.customer_name,
    vehicleRegistration: row.vehicle_registration,
    vehicleMakeModel: row.vehicle_make_model,
    vehicleType: row.vehicle_type,
    quotedAmount: row.quoted_amount,
    insurerName: row.insurer_name,
    paymentStatus: row.payment_status,
    policyStatus: row.policy_status,
    policyNumber: row.policy_number,
    policyUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
