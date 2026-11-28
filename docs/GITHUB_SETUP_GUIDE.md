# GitHub setup

1. Create a private repository if the project source or operational details should not be public.
2. Add the project files and protect the default branch with pull-request review and required CI checks.
3. Keep `.env.local`, Supabase service-role keys, email-provider keys, and customer application data out of Git.
4. Store production credentials in the hosting provider's encrypted environment variables.
5. Review the [security checklist](./SECURITY_TESTING_CHECKLIST.md) before publishing the repository or site.

The public website must not contain prices. Do not add a populated customer export or unverified service catalogue to the repository.
