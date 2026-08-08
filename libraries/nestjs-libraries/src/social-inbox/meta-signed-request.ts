import { createHmac, timingSafeEqual } from 'crypto';

export type MetaSignedRequestPayload = {
  algorithm?: string;
  issued_at?: number;
  user_id?: string | number;
  [key: string]: unknown;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  secret: string
): MetaSignedRequestPayload | undefined {
  if (!signedRequest || !secret) return undefined;

  const [encodedSignature, encodedPayload, ...extra] = signedRequest.split('.');
  if (!encodedSignature || !encodedPayload || extra.length) return undefined;

  let signature: Buffer;
  let payload: MetaSignedRequestPayload;
  try {
    signature = decodeBase64Url(encodedSignature);
    payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString('utf8')
    ) as MetaSignedRequestPayload;
  } catch {
    return undefined;
  }

  if (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    return undefined;
  }

  const expected = createHmac('sha256', secret).update(encodedPayload).digest();
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return undefined;
  }

  return payload;
}
