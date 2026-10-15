// Reviewed, fixed targets. Never take a schema, role or queue destination from HTTP input.
export const productionTarget = {
  origin: 'https://kkarn.vercel.app', schema: 'private_payments', role: 'portfolio_payments_api',
  projectId: 'prj_SV6MLqre8MI2eFF1hY2AdOJgik9z', environment: 'production',
  queueOrigin: 'https://qstash.upstash.io',
} as const;
export const sandboxTarget = {
  origin: 'https://portfolio-payments-uat-kashnordeens-projects.vercel.app',
  schema: 'private_payments_uat', role: 'portfolio_payments_uat',
  projectId: 'prj_w7Q4nTh7atnTv4T2G1t9CEWYxQGj', environment: 'sandbox',
  queueOrigin: 'https://qstash-us-east-1.upstash.io',
} as const;
export const paymentTarget = (environment: string) => environment === 'sandbox' ? sandboxTarget : productionTarget;
