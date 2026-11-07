-- Keep public catalogue and public settings readable without granting anonymous
-- callers EXECUTE access to the SECURITY DEFINER owner helper.
-- Owner-only management policies remain separate and continue to enforce AAL2.

DROP POLICY IF EXISTS categories_read_active ON public.service_categories;
CREATE POLICY categories_read_active
  ON public.service_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS services_read_active ON public.services;
CREATE POLICY services_read_active
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS settings_read_public ON public.website_settings;
CREATE POLICY settings_read_public
  ON public.website_settings
  FOR SELECT
  TO anon, authenticated
  USING (is_public);

DROP POLICY IF EXISTS settings_owner_read_all ON public.website_settings;
CREATE POLICY settings_owner_read_all
  ON public.website_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_owner()));
