-- Keep owner authorization role-based while customer/admin MFA is disabled.
-- The function remains SECURITY DEFINER so it can safely read user_roles
-- under the existing RLS model; search_path stays empty and all objects are qualified.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'owner'
  );
$function$;
