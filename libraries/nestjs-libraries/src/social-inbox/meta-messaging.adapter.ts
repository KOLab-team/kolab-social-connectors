import { SocialInboxPlatform } from '@prisma/client';
import {
  SocialMessagingAdapter,
  getMetaGraphVersion,
  parseGraphResponse,
} from '@gitroom/nestjs-libraries/social-inbox/social-messaging.adapter';
import {
  SendSocialMessageInput,
  SendSocialMessageResult,
} from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';

export class MetaMessagingAdapter implements SocialMessagingAdapter {
  constructor(public readonly platform: SocialInboxPlatform) {}

  supports(providerIdentifier: string) {
    if (this.platform === 'FACEBOOK') {
      return providerIdentifier === 'facebook';
    }

    return ['instagram', 'instagram-standalone'].includes(providerIdentifier);
  }

  async send({
    conversation,
    message,
  }: SendSocialMessageInput): Promise<SendSocialMessageResult> {
    const { integration } = conversation;
    const host =
      integration.providerIdentifier === 'instagram-standalone'
        ? 'graph.instagram.com'
        : 'graph.facebook.com';
    const url = `https://${host}/${getMetaGraphVersion()}/${
      integration.internalId
    }/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: conversation.replyTargetExternalId },
        message: { text: message.text },
        ...(this.platform === 'FACEBOOK' ? { messaging_type: 'RESPONSE' } : {}),
      }),
    });

    const payload = await parseGraphResponse(response);
    const externalId = payload.message_id || payload.id;
    if (!externalId) {
      throw new Error('Meta API did not return a message id');
    }

    return { externalId: String(externalId) };
  }
}
