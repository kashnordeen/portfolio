import { verifyProductionDatabase } from '../server/payments/production-preflight.ts';
import { uatFailureCode } from '../server/payments/uat-preflight.ts';

if (process.env.PAYMENT_PRODUCTION_PREFLIGHT === 'true') try {
  await verifyProductionDatabase(process.env);
  console.log('PRODUCTION_DB_CHECK_PASSED: verified TLS, restricted login, read-only transaction, UAT denied, five RLS tables; checkout closed.');
} catch (error) {
  console.error(`PRODUCTION_DB_CHECK_FAILED:${uatFailureCode(error)}`);
  process.exitCode = 1;
}
