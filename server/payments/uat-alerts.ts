// Preserve the explicitly sandbox-only interface used by UAT regression tests/tools.
import { handleDeliveryAlert, loadDeliveryAlertConfig } from './delivery-alerts.ts';
import type { AlertOptions } from './delivery-alerts.ts';

export const loadUatAlertConfig = (env: Record<string, string | undefined>) => loadDeliveryAlertConfig(env, 'sandbox');
export const handleUatAlert = (request: Request, options: AlertOptions = {}) =>
  handleDeliveryAlert(request, { ...options, expectedEnvironment: 'sandbox' });
