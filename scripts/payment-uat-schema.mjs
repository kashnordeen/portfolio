// Render an isolated, empty UAT schema from the reviewed canonical migrations.
// This script NEVER connects to a database or reads any environment variables.
import { readFile } from 'node:fs/promises';

export async function renderUatSchema() {
  const migrations = await Promise.all(['payment-orders.sql', 'payment-backend.sql', 'payment-jobs.sql', 'optional-project-reference.sql']
    .map(file => readFile(new URL(`../database/${file}`, import.meta.url), 'utf8')));
  const body = migrations.map(text => text
    .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '')
    .replaceAll('private_payments', 'private_payments_uat')
    .replaceAll('portfolio_payments_api', 'portfolio_payments_uat')).join('\n');
  return `BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='private_payments_uat') OR
     EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_payments_uat') THEN
    RAISE EXCEPTION 'UAT target already exists; do not reprovision or rotate credentials';
  END IF;
END $$;
${body}
ALTER TABLE private_payments_uat.orders ADD CONSTRAINT uat_orders_sandbox_only CHECK(environment='sandbox');
ALTER TABLE private_payments_uat.reconciliation_jobs ADD CONSTRAINT uat_jobs_sandbox_only CHECK(environment='sandbox');
REVOKE ALL ON SCHEMA private_payments_uat FROM PUBLIC,anon,authenticated,service_role,portfolio_payments_api;
REVOKE ALL ON ALL TABLES IN SCHEMA private_payments_uat FROM PUBLIC,anon,authenticated,service_role,portfolio_payments_api;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private_payments_uat FROM PUBLIC,anon,authenticated,service_role,portfolio_payments_api;
ALTER ROLE portfolio_payments_uat CONNECTION LIMIT 4;
ALTER ROLE portfolio_payments_uat SET statement_timeout='3s';
ALTER ROLE portfolio_payments_uat SET idle_in_transaction_session_timeout='10s';
COMMIT;
`;
}
