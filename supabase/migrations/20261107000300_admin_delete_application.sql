CREATE OR REPLACE FUNCTION public.admin_delete_application(
  p_application_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tracking_id text;
  v_document_paths text[];
  v_audit_id uuid;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Owner authorization required';
  END IF;

  SELECT tracking_id
    INTO v_tracking_id
    FROM public.applications
    WHERE id = p_application_id
    FOR UPDATE;

  IF v_tracking_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO v_document_paths
    FROM public.application_documents
    WHERE application_id = p_application_id;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_actor_id,
    'application_deleted',
    'application',
    v_tracking_id,
    jsonb_build_object(
      'application_id', p_application_id,
      'document_count', cardinality(v_document_paths),
      'payment_records_cascaded', true,
      'remarks_and_status_history_cascaded', true
    )
  )
  RETURNING id INTO v_audit_id;

  DELETE FROM public.applications WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'tracking_id', v_tracking_id,
    'document_paths', to_jsonb(v_document_paths),
    'audit_id', v_audit_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_application(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_application(uuid, uuid) TO service_role;
