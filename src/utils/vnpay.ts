import crypto from 'crypto';

const VNPAY_URL = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || '';
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET || '';

interface VnpayParams {
  [key: string]: string | number | undefined;
}

const pad = (n: number): string => String(n).padStart(2, '0');

// VNPAY requires yyyyMMddHHmmss in UTC+7
const formatVnpDate = (date: Date): string => {
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
};

// Sort keys ascending, build `key=value&...` payload (skip empty), return URL-encoded query + raw hash payload
const buildSorted = (params: VnpayParams): { query: string; payload: string } => {
  const entries = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => ({ k, v: String(params[k]) }));
  const query = entries.map(({ k, v }) => `${k}=${encodeURIComponent(v)}`).join('&');
  const payload = entries.map(({ k, v }) => `${k}=${v}`).join('&');
  return { query, payload };
};

// Sign a set of VNPAY params (already filtered) with the given secret.
export const signVnpayParams = (params: VnpayParams, secret: string): string => {
  const { payload } = buildSorted(params);
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
};

export const createPaymentUrl = (opts: {
  orderCode: number;
  amount: number;
  returnUrl: string;
  ipnUrl: string;
}): string => {
  const now = new Date();
  const params: VnpayParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_Amount: opts.amount * 100, // VND * 100, integer
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(opts.orderCode),
    vnp_OrderInfo: 'ReMind appointment ' + opts.orderCode,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: opts.returnUrl,
    vnp_IpnUrl: opts.ipnUrl,
    vnp_CreateDate: formatVnpDate(now),
    vnp_ExpireDate: formatVnpDate(new Date(now.getTime() + 15 * 60 * 1000)),
  };

  const secureHash = signVnpayParams(params, VNPAY_HASH_SECRET);

  const { query } = buildSorted(params);
  return `${VNPAY_URL}?${query}&vnp_SecureHash=${secureHash}`;
};

// Build the param set VNPAY uses for signature verification: all received
// params except vnp_SecureHash / vnp_SecureHashType, skipping empty values.
const buildVerifyParams = (query: Record<string, unknown>): VnpayParams => {
  const params: VnpayParams = {};
  for (const [k, v] of Object.entries(query)) {
    if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    if (v === undefined || v === null || v === '') continue;
    params[k] = String(v);
  }
  return params;
};

// Compute the expected secure hash for an incoming VNPAY query (e.g. IPN/return).
export const computeVnpaySecureHash = (query: Record<string, unknown>, secret: string): string =>
  signVnpayParams(buildVerifyParams(query), secret);

// Recompute secure hash from all params except vnp_SecureHash (and vnp_SecureHashType)
export const verifyVnpay = (query: Record<string, unknown>): boolean => {
  const computed = computeVnpaySecureHash(query, VNPAY_HASH_SECRET);
  const provided = String(query['vnp_SecureHash'] || '').toLowerCase();

  return computed === provided;
};
