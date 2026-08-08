import { SocialInboxPlatform } from '@prisma/client';
import {
  SocialMessagingAdapter,
  parseGraphResponse,
} from '@gitroom/nestjs-libraries/social-inbox/social-messaging.adapter';
import {
  SendSocialMessageInput,
  SendSocialMessageResult,
} from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';

export class ThreadsRepliesAdapter implements SocialMessagingAdapter {
  readonly platform: SocialInboxPlatform = 'THREADS';

  supports(providerIdentifier: string) {
    return providerIdentifier === 'threads';
  }

  async send({
    conversation,
    message,
  }: SendSocialMessageInput): Promise<SendSocialMessageResult> {
    const { integration } = conversation;
    if (!conversation.replyTargetExternalId) {
      throw new Error('This Threads conversation has no reply target');
    }

    const createBody = new URLSearchParams({
      media_type: 'TEXT',
      text: message.text || '',
      reply_to_id: conversation.replyTargetExternalId,
      access_token: integration.token,
    });
    const createResponse = await fetch(
      `https://graph.threads.net/v1.0/${integration.internalId}/threads`,
      { method: 'POST', body: createBody }
    );
    const created = await parseGraphResponse(createResponse);
    await this.waitUntilReady(String(created.id), integration.token);

    const publishBody = new URLSearchParams({
      creation_id: created.id,
      access_token: integration.token,
    });
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${integration.internalId}/threads_publish`,
      { method: 'POST', body: publishBody }
    );
    const published = await parseGraphResponse(publishResponse);
    if (!published.id) {
      throw new Error('Threads API did not return a reply id');
    }

    return { externalId: String(published.id) };
  }

  private async waitUntilReady(creationId: string, accessToken: string) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const response = await fetch(
        `https://graph.threads.net/v1.0/${creationId}` +
          `?fields=status,error_message&access_token=${encodeURIComponent(
            accessToken
          )}`
      );
      const payload = await parseGraphResponse(response);
      if (payload.status === 'FINISHED') return;
      if (payload.status === 'ERROR') {
        throw new Error(
          payload.error_message || 'Threads reply creation failed'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Threads reply creation timed out');
  }
}
