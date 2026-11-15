alter table public.print_jobs drop constraint if exists print_jobs_status_check;
alter table public.print_jobs add constraint print_jobs_status_check check(status in ('awaiting_payment','queued','printing','sent_to_printer','completed','failed','cancelled'));
alter table public.print_jobs add column if not exists spooler_submitted_at timestamptz;
