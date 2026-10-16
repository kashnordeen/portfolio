import { handlePayment } from '../../server/payments/handler.ts';
import { diagnoseUatWebhook } from '../../server/payments/webhook-diagnostics.ts';
export default { fetch: (request: Request) => diagnoseUatWebhook(request, () => handlePayment('webhook', request)) };
