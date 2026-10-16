import { handleDeliveryAlert } from '../../server/payments/delivery-alerts.ts';
export const config = { maxDuration: 30 };
export default { fetch: (request: Request) => handleDeliveryAlert(request) };
