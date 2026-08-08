import {
  Integration,
  SocialInboxConversation,
  SocialInboxMessage,
  SocialInboxPlatform,
} from '@prisma/client';

export type SocialConversationWithIntegration = SocialInboxConversation & {
  integration: Integration;
};

export type SendSocialMessageInput = {
  conversation: SocialConversationWithIntegration;
  message: SocialInboxMessage;
};

export type SendSocialMessageResult = {
  externalId: string;
  sentAt?: Date;
};

export type MetaWebhookPlatform = Extract<
  SocialInboxPlatform,
  'FACEBOOK' | 'INSTAGRAM'
>;

export type NormalizedMetaAttachment = {
  externalId?: string;
  type: string;
  url?: string;
  name?: string;
};

export type NormalizedMetaMessage = {
  accountExternalId: string;
  contactExternalId: string;
  externalId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text?: string;
  senderExternalId?: string;
  replyToExternalId?: string;
  sentAt: Date;
  attachments: NormalizedMetaAttachment[];
  rawPayload: Record<string, unknown>;
};

export type NormalizedMetaStatus = {
  accountExternalId: string;
  externalIds?: string[];
  watermark?: Date;
  status: 'DELIVERED' | 'READ';
};

export type NormalizedMetaEvent =
  | { type: 'message'; data: NormalizedMetaMessage }
  | { type: 'status'; data: NormalizedMetaStatus };
