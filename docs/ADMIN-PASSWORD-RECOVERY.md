# Admin password recovery: OTP email template

The admin portal uses a six-digit recovery code so email link scanners cannot consume a one-time recovery URL.

In the Supabase Dashboard for project `dyzyfugxzsdvboxerbxv`:

1. Open **Authentication → Email Templates → Reset Password**.
2. Set the subject to: `Your BABA'S CYBER CAFE admin recovery code`.
3. Replace the template body with the following HTML:

```html
<h2>BABA'S CYBER CAFE — Admin password recovery</h2>
<p>A password reset was requested for the owner account.</p>
<p>Your six-digit recovery code is:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>Enter this code only on https://babacybercafe.in/admin/login.</p>
<p>This code is single-use and expires. Do not forward it or share it with anyone.</p>
<p>If you did not request this code, ignore this email.</p>
```

4. Save the template. Do not include `{{ .ConfirmationURL }}` in this recovery template.
5. In **Authentication → URL Configuration**, ensure `https://babacybercafe.in/admin/login` is an allowed redirect URL.

Then open the admin login page, request a fresh recovery code, and enter the six digits from the newest email. After verification, choose a password of at least 12 characters and confirm it.

The recovery code is not the password. Never send the code or password in chat.
