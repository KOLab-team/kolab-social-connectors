import { createHmac, timingSafeEqual } from 'crypto';
import {
  MetaWebhookPlatform,
  NormalizedMetaEvent,
} from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secrets: string[]
) {
  if (!signature?.startsWith('sha256=') || !rawBody.length) {
    return false;
  }

  const received = Buffer.from(signature.slice('sha256='.length), 'hex');
  return secrets.filter(Boolean).some((secret) => {
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  });
}

export function normalizeMetaWebhook(
  platform: MetaWebhookPlatform,
  payload: any
): NormalizedMetaEvent[] {
  const normalized: NormalizedMetaEvent[] = [];

  for (const entry of payload?.entry || []) {
    const accountExternalId = String(entry.id || '');
    if (!accountExternalId) continue;

    for (const event of [
      ...(entry.messaging || []),
      ...(entry.standby || []),
    ]) {
      if (event.message?.mid) {
        const isEcho = Boolean(event.message.is_echo);
        const contactExternalId = String(
          isEcho ? event.recipient?.id : event.sender?.id
        );
        if (!contactExternalId) continue;

        normalized.push({
          type: 'message',
          data: {
            accountExternalId,
            contactExternalId,
            externalId: String(event.message.mid),
            direction: isEcho ? 'OUTBOUND' : 'INBOUND',
            text: event.message.text,
            senderExternalId: event.sender?.id
              ? String(event.sender.id)
              : undefined,
            replyToExternalId: event.message.reply_to?.mid,
            sentAt: new Date(event.timestamp || Date.now()),
            attachments: (event.message.attachments || []).map(
              (attachment: any) => ({
                externalId: attachment.payload?.sticker_id
                  ? String(attachment.payload.sticker_id)
                  : undefined,
                type: attachment.type || 'file',
                url:
                  attachment.payload?.url ||
                  attachment.payload?.image_url ||
                  attachment.payload?.video_url,
                name: attachment.payload?.name,
              })
            ),
            rawPayload: event,
          },
        });
      }

      if (event.delivery) {
        normalized.push({
          type: 'status',
          data: {
            accountExternalId,
            externalIds: event.delivery.mids?.map(String),
            watermark: event.delivery.watermark
              ? new Date(event.delivery.watermark)
              : undefined,
            status: 'DELIVERED',
          },
        });
      }

      if (event.read?.watermark) {
        normalized.push({
          type: 'status',
          data: {
            accountExternalId,
            watermark: new Date(event.read.watermark),
            status: 'READ',
          },
        });
      }
    }
  }

  return normalized;
}
