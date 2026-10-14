import { handleJob } from '../../server/payments/job-handler.ts';
export const config = { maxDuration: 60 };
export default { fetch: (request: Request) => handleJob(request) };
