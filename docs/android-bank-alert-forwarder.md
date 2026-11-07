# Android bank SMS / notification forwarder (owner-operated)

This website already exposes the Supabase Edge Function:

`POST https://dyzyfugxzsdvboxerbxv.supabase.co/functions/v1/bank-sms-webhook`

It accepts an ICICI credit alert only when:
- the request has the secret in the `x-api-key` HTTP header;
- `sender` identifies ICICI BANK;
- the notification contains a recent timestamp and a credit message;
- the payload is valid JSON.

Example request body:

```json
{
  "sender": "ICICI BANK",
  "message": "PASTE THE ORIGINAL CREDIT SMS OR NOTIFICATION TEXT",
  "timestamp": 1794040000000
}
```

Use the original bank message without rewriting it. Timestamp is Unix epoch milliseconds. Do not include a PIN, OTP, full account number, card number, login details or any customer personal data that is not needed.

## MacroDroid (Android)

1. Install MacroDroid from its official Play Store listing and create a macro.
2. Trigger: **SMS Received** from the bank's sender ID, or **Notification Received** from the official ICICI app. Use the narrowest bank sender/app filter available.
3. Add a condition so only messages containing a credit/credited term are forwarded. Do not forward debit, OTP, balance-only or login notifications.
4. Action: **HTTP Request** / **Web Request**.
5. Method: POST.
6. URL: the Edge Function URL above.
7. Header: `x-api-key: YOUR_LONG_RANDOM_WEBHOOK_SECRET`.
8. Body type: JSON. Map the original sender, original SMS/notification text, and event timestamp into the JSON fields shown above. If MacroDroid exposes the notification/SMS received timestamp as seconds, multiply by 1000; otherwise send milliseconds.
9. Save and test using a genuine low-value credit notification. Check **Admin → UPI payments → Bank alerts**.

## Tasker alternative

1. Create an **Event → Phone → Received Text** profile for the bank sender, or **Event → UI → Notification** for the ICICI app.
2. Add a task with an **HTTP Request** action: POST to the URL above.
3. Set header `x-api-key` to the webhook secret.
4. Set JSON body fields `sender`, `message`, and `timestamp` from the event variables.
5. Restrict the profile to credit notifications and test with a genuine bank credit.

## Security and verification limitations

- Keep the webhook secret only in the private automation configuration. Never put it in website JavaScript, a public GitHub repository, or a customer-facing QR code. Rotate it immediately if exposed.
- Android SMS/notification forwarding is a convenience signal, not a cryptographically signed bank webhook. A rooted/compromised phone, spoofed notification, or automation variable mistake can forge it.
- This endpoint stores alerts as **unmatched/review** evidence. It does not mark payments as paid automatically. The owner must verify the exact credit in the ICICI account/bank statement and then match it in the admin portal.
- A true unattended automatic success flow requires an official bank-provided signed webhook/API or a bank statement feed with an independently verifiable source. UPI QR/intent itself cannot report settlement to your website.
