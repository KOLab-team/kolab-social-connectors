import { createHmac } from 'crypto';
import {
  normalizeMetaWebhook,
  verifyMetaWebhookSignature,
} from '@gitroom/nestjs-libraries/social-inbox/meta-webhook';

describe('Meta inbox webhooks', () => {
  it('verifies the raw request body with the app secret', () => {
    const body = Buffer.from('{"object":"page"}');
    const secret = 'test-secret';
    const signature = `sha256=${createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;

    expect(verifyMetaWebhookSignature(body, signature, [secret])).toBe(true);
    expect(verifyMetaWebhookSignature(body, signature, ['wrong-secret'])).toBe(
      false
    );
  });

  it('normalizes inbound messages, echoes, delivery, and read receipts', () => {
    const events = normalizeMetaWebhook('FACEBOOK', {
      entry: [
        {
          id: 'page-1',
          messaging: [
            {
              sender: { id: 'person-1' },
              recipient: { id: 'page-1' },
              timestamp: 1000,
              message: { mid: 'in-1', text: 'Hello' },
            },
            {
              sender: { id: 'page-1' },
              recipient: { id: 'person-1' },
              timestamp: 2000,
              message: { mid: 'out-1', text: 'Hi', is_echo: true },
            },
            { delivery: { mids: ['out-1'], watermark: 2500 } },
            { read: { watermark: 3000 } },
          ],
        },
      ],
    });

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      type: 'message',
      data: {
        accountExternalId: 'page-1',
        contactExternalId: 'person-1',
        direction: 'INBOUND',
        externalId: 'in-1',
      },
    });
    expect(events[1]).toMatchObject({
      type: 'message',
      data: { contactExternalId: 'person-1', direction: 'OUTBOUND' },
    });
    expect(events[2]).toMatchObject({
      type: 'status',
      data: { status: 'DELIVERED', externalIds: ['out-1'] },
    });
    expect(events[3]).toMatchObject({
      type: 'status',
      data: { status: 'READ' },
    });
  });
});
