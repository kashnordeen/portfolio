import { verifyUatDatabase, uatFailureCode } from '../server/payments/uat-preflight.ts';

try {
  await verifyUatDatabase(process.env);
  console.log('UAT_DB_CHECK_PASSED: verified TLS, restricted UAT login, read-only transaction, live schema denied, five RLS tables.');
  console.log('UAT_CALLBACK_KEY_PRESENT: server-only system credential; value not logged.');
} catch (error) {
  // Deliberately exclude error objects/messages, database URLs, usernames and credentials.
  console.error(`UAT_DB_CHECK_FAILED:${uatFailureCode(error)}`);
  process.exitCode = 1;
}
