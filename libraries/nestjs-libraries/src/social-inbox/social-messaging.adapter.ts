import { SocialInboxPlatform } from '@prisma/client';
import {
  SendSocialMessageInput,
  SendSocialMessageResult,
} from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';

export interface SocialMessagingAdapter {
  readonly platform: SocialInboxPlatform;
  supports(providerIdentifier: string): boolean;
  send(input: SendSocialMessageInput): Promise<SendSocialMessageResult>;
}

export const getMetaGraphVersion = () =>
  process.env.META_GRAPH_VERSION || 'v25.0';

export async function parseGraphResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Meta API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}
