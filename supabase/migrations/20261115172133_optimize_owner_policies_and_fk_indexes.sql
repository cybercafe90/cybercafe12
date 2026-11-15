-- Performance and RLS policy optimizations.
-- Adds indexes for foreign keys and ensures auth.uid() is evaluated once per statement.

CREATE INDEX IF NOT EXISTS customer_feedback_assigned_to_idx
  ON public.customer_feedback (assigned_to);
CREATE INDEX IF NOT EXISTS customer_feedback_history_actor_id_idx
  ON public.customer_feedback_history (actor_id);
CREATE INDEX IF NOT EXISTS customer_feedback_history_feedback_id_idx
  ON public.customer_feedback_history (feedback_id);
CREATE INDEX IF NOT EXISTS print_agent_devices_created_by_idx
  ON public.print_agent_devices (created_by);
CREATE INDEX IF NOT EXISTS print_jobs_agent_id_idx
  ON public.print_jobs (agent_id);
CREATE INDEX IF NOT EXISTS razorpay_webhook_events_payment_id_idx
  ON public.razorpay_webhook_events (payment_id);

ALTER POLICY "Owner can read feedback" ON public.customer_feedback
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owner can update feedback" ON public.customer_feedback
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owner can read feedback history" ON public.customer_feedback_history
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owners can manage print agent devices" ON public.print_agent_devices
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owners can add print job events" ON public.print_job_events
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owners can read print job events" ON public.print_job_events
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

ALTER POLICY "Owners can manage print jobs" ON public.print_jobs
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'owner'
  ));

-- Remove only the confirmed duplicate: identical definition to security_events_source_ip_idx.
DROP INDEX IF EXISTS public.security_events_source_ip_occurred_at_idx;
