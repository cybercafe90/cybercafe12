-- Add per-location analytics attribution for VIP multi-location QR codes.
-- Safe additive migration; apply to Preview first and Production only after release approval.
ALTER TABLE smartqr_events ADD COLUMN location_id INTEGER REFERENCES smartqr_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_smartqr_events_location_created ON smartqr_events(location_id, created_at);
