# Admin password recovery: secure email-link flow

The admin portal currently uses Supabase's standard password-recovery email link. The app captures the `PASSWORD_RECOVERY` auth event as soon as the Supabase client initializes, so the recovery screen still appears if React mounts after the redirect has been processed.

In the Supabase Dashboard for project `dyzyfugxzsdvboxerbxv`:

1. Open **Authentication → Email Templates → Reset Password**.
2. Use a subject such as: `Reset your BABA'S CYBER CAFE admin password`.
3. Ensure the template contains a clickable link using Supabase’s confirmation URL, for example:

```html
<h2>BABA'S CYBER CAFE — Admin password recovery</h2>
<p>A password reset was requested for the owner account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset your admin password</a></p>
<p>This link is single-use and expires. If you did not request it, ignore this email.</p>
```

4. Do not replace the confirmation URL with a plain `{{ .Token }}` code unless the application is changed to implement OTP verification.
5. In **Authentication → URL Configuration**, ensure `https://babacybercafe.in/admin/login` is an allowed redirect URL.

Then open the admin login page, request a fresh reset email, and open the newest link once. The admin page should display the new-password form. Choose a password of at least 12 characters and confirm it. If an email-security scanner consumes the one-time link before you do, request a fresh link and open it directly from the mailbox.

The reset link is not the password. Never send the link or password in chat.
