create policy payment_deny_browser_access on public.payment
for all to anon, authenticated
using (false) with check (false);
