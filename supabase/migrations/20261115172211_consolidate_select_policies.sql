-- Merge overlapping permissive SELECT policies while preserving access semantics.

DROP POLICY IF EXISTS applications_customer_read_own ON public.applications;
DROP POLICY IF EXISTS applications_owner_read_all ON public.applications;
CREATE POLICY applications_customer_or_owner_read
  ON public.applications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT private.is_owner()));

DROP POLICY IF EXISTS categories_owner_manage ON public.service_categories;
DROP POLICY IF EXISTS categories_read_active ON public.service_categories;
CREATE POLICY categories_read_active_or_owner
  ON public.service_categories FOR SELECT TO anon, authenticated
  USING (is_active OR (SELECT private.is_owner()));
CREATE POLICY categories_owner_insert
  ON public.service_categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_owner()));
CREATE POLICY categories_owner_update
  ON public.service_categories FOR UPDATE TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));
CREATE POLICY categories_owner_delete
  ON public.service_categories FOR DELETE TO authenticated
  USING ((SELECT private.is_owner()));

DROP POLICY IF EXISTS services_owner_manage ON public.services;
DROP POLICY IF EXISTS services_read_active ON public.services;
CREATE POLICY services_read_active_or_owner
  ON public.services FOR SELECT TO anon, authenticated
  USING (is_active OR (SELECT private.is_owner()));
CREATE POLICY services_owner_insert
  ON public.services FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_owner()));
CREATE POLICY services_owner_update
  ON public.services FOR UPDATE TO authenticated
  USING ((SELECT private.is_owner()))
  WITH CHECK ((SELECT private.is_owner()));
CREATE POLICY services_owner_delete
  ON public.services FOR DELETE TO authenticated
  USING ((SELECT private.is_owner()));

DROP POLICY IF EXISTS settings_owner_read_all ON public.website_settings;
DROP POLICY IF EXISTS settings_read_public ON public.website_settings;
CREATE POLICY settings_public_or_owner_read
  ON public.website_settings FOR SELECT TO anon, authenticated
  USING (is_public OR (SELECT private.is_owner()));
