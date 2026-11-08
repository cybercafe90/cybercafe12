# AI customer assistant setup

The customer assistant uses a Supabase Edge Function to call Gemini 2.5 Flash. Public service/document questions are sent with Google Search grounding enabled. The browser never receives the Gemini API key.

## Required secret

1. Create a Gemini API key in Google AI Studio.
2. Open Supabase Dashboard → project dyzyfugxzsdvboxerbxv → Edge Functions → Secrets.
3. Add the key name GEMINI_API_KEY and paste the key as its value. Save.
4. Never add this key to GitHub, Cloudflare Pages variables, browser code, or a chat message.

The Google free tier may use prompts and responses to improve Google products. This implementation is designed to send only general, anonymized public-service questions. The browser and Edge Function reject common personal identifiers (phone, email, Aadhaar/PAN-like numbers, OTPs, passwords, PINs and bank details). Customers are warned not to enter any personal information. This filtering is a safeguard, not a guarantee that every possible personal detail can be detected.

## Behavior and safeguards

- Only active public service catalogue entries are used as context; catalogue document lists are not treated as government-verified requirements.
- For service/document questions, Gemini Google Search grounding is enabled. The UI displays only sources on official-looking .gov.in or .nic.in domains.
- If no official source is returned, the assistant says it could not verify the current requirement instead of inventing a checklist.
- Chat history is held in the browser session only and is not written to Supabase.
- The public endpoint is rate-limited to 12 requests per 10 minutes per client IP and 400 requests per day globally, using the existing rate-limit infrastructure. The daily cap stays below the documented 500 requests/day free Google Search grounding quota for Gemini 2.5 Flash.
- The assistant does not access customer applications, admin data, uploaded documents, payment records, or authentication details.
- It never quotes public service rates.

## Cost and availability

Gemini API free-tier quotas and data-use terms can change. Review Google's current Gemini API pricing and data-use terms before launch. The assistant is not available until GEMINI_API_KEY is configured in Supabase.
