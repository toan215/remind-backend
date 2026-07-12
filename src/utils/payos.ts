import { PayOS } from '@payos/node';

export const getPayOSClient = (): PayOS => {
  const clientId = process.env.PAYOS_CLIENT_ID || '';
  const apiKey = process.env.PAYOS_API_KEY || '';
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY || '';

  return new PayOS({ clientId, apiKey, checksumKey });
};
