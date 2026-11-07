-- Remove the AAL2/TOTP requirement from owner authorization.
-- Owner access remains restricted to authenticated users with an explicit owner role.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'owner'
  );
$function$;
