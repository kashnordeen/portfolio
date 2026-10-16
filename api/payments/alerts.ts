import { handleUatAlert } from '../../server/payments/uat-alerts.ts';
export const config = { maxDuration: 30 };
export default { fetch: (request: Request) => handleUatAlert(request) };
