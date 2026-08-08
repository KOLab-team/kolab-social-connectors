import { createHmac } from 'crypto';
import { verifyMetaSignedRequest } from './meta-signed-request';

function sign(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${signature}.${encodedPayload}`;
}

describe('verifyMetaSignedRequest', () => {
  it('returns a valid HMAC-SHA256 payload', () => {
    const request = sign(
      { algorithm: 'HMAC-SHA256', user_id: 'meta-user-1' },
      'test-secret'
    );

    expect(verifyMetaSignedRequest(request, 'test-secret')).toMatchObject({
      algorithm: 'HMAC-SHA256',
      user_id: 'meta-user-1',
    });
  });

  it('rejects a request signed with another secret', () => {
    const request = sign({ user_id: 'meta-user-1' }, 'wrong-secret');

    expect(verifyMetaSignedRequest(request, 'test-secret')).toBeUndefined();
  });

  it('rejects unsupported algorithms and malformed input', () => {
    const request = sign(
      { algorithm: 'HMAC-SHA1', user_id: 'meta-user-1' },
      'test-secret'
    );

    expect(verifyMetaSignedRequest(request, 'test-secret')).toBeUndefined();
    expect(verifyMetaSignedRequest('not-valid', 'test-secret')).toBeUndefined();
  });
});
