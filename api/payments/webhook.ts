import { handlePayment } from '../../server/payments/handler.ts';
export default { fetch: (request: Request) => handlePayment('webhook', request) };
