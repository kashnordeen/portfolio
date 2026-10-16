import { verifyActiveUatDatabase, uatFailureCode } from '../server/payments/uat-preflight.ts';

try {
  await verifyActiveUatDatabase(process.env);
  console.log('UAT_ACTIVE_CHECK_PASSED: sandbox project checkout and signed jobs only; community disabled; fixed target, verified TLS, restricted read-only database check.');
} catch (error) {
  // Never log raw errors, connection strings, callback keys or provider credentials.
  console.error(`UAT_ACTIVE_CHECK_FAILED:${uatFailureCode(error)}`);
  process.exitCode = 1;
}
