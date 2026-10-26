# TaskLink Supabase setup

The site now uses Supabase Auth and the TaskLink database for accounts, profiles, tasks, applications, reviews, and messages. The SQL migrations in supabase/migrations/ were applied to the connected TaskLink project.

## Before first use

1. Serve or deploy this folder over HTTP(S); do not open an HTML file directly.
2. In Supabase Authentication > URL Configuration, set the deployed site as the Site URL and allow the registration/login redirect URLs used by your deployment and local server.
3. In Supabase Authentication > Providers, keep Email enabled and decide whether email confirmation is required. The profile-linking function requires a confirmed email.
4. Use js/supabase-config.js for the project URL and publishable key. That key is intended for browser use. Never add a service-role or secret key to this site. Confirm that the public schema and the RPC functions are included in Supabase Data API exposed schemas.

Existing TaskLink user rows have not yet been linked to Auth accounts. When a person signs in with a confirmed email that matches an unlinked legacy row, the database links that row; other users receive a new profile. Existing legacy passwords were not present in the password_hash column, so users must set a new password through Supabase Auth.

## Enabled database workflows

- Email/password signup and login through Supabase Auth.
- Profiles owned by the signed-in account.
- Task creation, owner cancellation/completion, and public reads of open tasks.
- Applications by provider accounts; task owners can accept or decline, and applicants can withdraw.
- Messages attached to an application and limited to its two participants.
- Reviews only between the participants of a completed task.
- Table grants and RLS policies restrict writes to the owner or the appropriate participant. Payment table access is intentionally closed to browser clients.

## Payments

The database contains a payment table, but the website does not accept or confirm payments. A payment provider has not been selected. When one is chosen, payment creation and status updates should happen through a server-side Edge Function and verified provider webhook, never through a browser write.

## Database migrations

Apply the migrations in timestamp order when setting up another environment. They are recorded in the connected project's migration history.
