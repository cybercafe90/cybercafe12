-- Add the Razorpay plan reference needed for reusable monthly subscription plans.
-- Additive migration: existing subscriptions and payments are preserved.
ALTER TABLE smartqr_subscriptions ADD COLUMN razorpay_plan_id TEXT;
