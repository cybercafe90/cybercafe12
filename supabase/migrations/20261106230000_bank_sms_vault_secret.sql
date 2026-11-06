-- Keep the bank relay credential encrypted in Supabase Vault.
-- Only the service role may call the boolean verifier; the secret itself is never returned.
CREATE OR REPLACE FUNCTION public.verify_bank_sms_webhook_key(p_supplied_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_supplied_key IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM vault.decrypted_secrets
      WHERE name = 'BANK_SMS_WEBHOOK_API_KEY'
        AND decrypted_secret = p_supplied_key
    );
$function$;

REVOKE ALL ON FUNCTION public.verify_bank_sms_webhook_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_bank_sms_webhook_key(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_bank_sms_webhook_key(text) TO service_role;
