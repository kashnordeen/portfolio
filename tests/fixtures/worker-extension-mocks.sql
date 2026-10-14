-- TEST-ONLY interfaces in an ephemeral PGlite database. No networking, Cron execution,
-- encryption or real credentials. Do not apply this fixture to Supabase.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE ROLE portfolio_payments_api NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA cron;
CREATE SCHEMA net;
CREATE SCHEMA vault;
CREATE TABLE cron.job (
  jobid bigserial PRIMARY KEY, jobname text UNIQUE NOT NULL,
  schedule text NOT NULL, command text NOT NULL,
  username text NOT NULL DEFAULT current_user, active boolean NOT NULL DEFAULT true
);
CREATE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job(jobname, schedule, command) VALUES ($1, $2, $3) RETURNING jobid;
$$;
CREATE FUNCTION cron.alter_job(job_id bigint, active boolean) RETURNS void LANGUAGE sql AS $$
  UPDATE cron.job SET active = $2 WHERE jobid = $1;
$$;
CREATE TABLE vault.fake_secrets(name text, decrypted_secret text);
CREATE VIEW vault.decrypted_secrets AS SELECT * FROM vault.fake_secrets;
CREATE TABLE net.http_request_queue (
  id bigserial PRIMARY KEY, method text NOT NULL, url text NOT NULL,
  headers jsonb NOT NULL, body bytea, timeout_milliseconds integer NOT NULL
);
CREATE TABLE net._http_response (
  id bigint, status_code integer, content_type text, headers jsonb, content text,
  timed_out boolean, error_msg text, created timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION net.http_post(
  url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 2000
) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.http_request_queue(method, url, headers, body, timeout_milliseconds)
  VALUES ('POST', $1, $4, convert_to($2::text, 'UTF8'), $5) RETURNING id;
$$;
