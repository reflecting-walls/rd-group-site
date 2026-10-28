-- Daily review sync at 6:15 am Central (11:15 UTC). Run after deploying the
-- sync-reviews function and setting the CRON_SECRET function secret.
-- Replace the two placeholders before running.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sync-reviews-daily') where exists (select 1 from cron.job where jobname = 'sync-reviews-daily');
select cron.schedule('sync-reviews-daily', '15 11 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-reviews',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer cron', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);
