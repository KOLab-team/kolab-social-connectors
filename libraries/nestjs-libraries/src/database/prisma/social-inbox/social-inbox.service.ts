import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Integration,
  Prisma,
  SocialConversationStatus,
  SocialInboxPlatform,
} from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { MetaMessagingAdapter } from '@gitroom/nestjs-libraries/social-inbox/meta-messaging.adapter';
import {
  getMetaGraphVersion,
  SocialMessagingAdapter,
} from '@gitroom/nestjs-libraries/social-inbox/social-messaging.adapter';
import { ThreadsRepliesAdapter } from '@gitroom/nestjs-libraries/social-inbox/threads-replies.adapter';
import {
  MetaWebhookPlatform,
  NormalizedMetaMessage,
  NormalizedMetaStatus,
} from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';
import { normalizeMetaWebhook } from '@gitroom/nestjs-libraries/social-inbox/meta-webhook';

const inboxProviders = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'threads',
];

@Injectable()
export class SocialInboxService {
  private readonly adapters: SocialMessagingAdapter[] = [
    new MetaMessagingAdapter('FACEBOOK'),
    new MetaMessagingAdapter('INSTAGRAM'),
    new ThreadsRepliesAdapter(),
  ];

  constructor(private readonly prisma: PrismaService) {}

  async listConversations(
    organizationId: string,
    filters: {
      status?: SocialConversationStatus;
      platform?: SocialInboxPlatform;
      search?: string;
      cursor?: string;
    }
  ) {
    const take = 31;
    const conversations = await this.prisma.socialInboxConversation.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.platform ? { platform: filters.platform } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  contact: {
                    name: { contains: filters.search, mode: 'insensitive' },
                  },
                },
                {
                  contact: {
                    username: {
                      contains: filters.search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  messages: {
                    some: {
                      text: { contains: filters.search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        contact: true,
        integration: {
          select: {
            id: true,
            name: true,
            picture: true,
            providerIdentifier: true,
            refreshNeeded: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            text: true,
            direction: true,
            status: true,
            sentAt: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = conversations.length === take;
    const page = hasMore ? conversations.slice(0, -1) : conversations;

    return {
      conversations: page,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
    };
  }

  async getConversation(organizationId: string, id: string) {
    const conversation = await this.prisma.socialInboxConversation.findFirst({
      where: { id, organizationId },
      include: {
        contact: true,
        integration: {
          select: {
            id: true,
            name: true,
            picture: true,
            providerIdentifier: true,
            refreshNeeded: true,
          },
        },
        messages: {
          orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
          include: { attachments: true },
        },
        notes: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (conversation.unreadCount) {
      await this.prisma.socialInboxConversation.update({
        where: { id },
        data: { unreadCount: 0, lastReadAt: new Date() },
      });
      conversation.unreadCount = 0;
    }

    return conversation;
  }

  async setStatus(
    organizationId: string,
    id: string,
    status: SocialConversationStatus
  ) {
    const updated = await this.prisma.socialInboxConversation.updateMany({
      where: { id, organizationId },
      data: { status },
    });
    if (!updated.count) throw new NotFoundException('Conversation not found');
    return { success: true };
  }

  async addNote(
    organizationId: string,
    conversationId: string,
    authorId: string,
    content: string
  ) {
    if (!content) throw new BadRequestException('Note cannot be empty');
    await this.assertConversation(organizationId, conversationId);
    return this.prisma.socialInboxInternalNote.create({
      data: { conversationId, authorId, content },
    });
  }

  async createPendingMessage(
    organizationId: string,
    conversationId: string,
    text: string,
    clientRequestId?: string
  ) {
    if (!text) throw new BadRequestException('Message cannot be empty');
    const conversation = await this.assertConversation(
      organizationId,
      conversationId
    );
    if (!conversation.replyTargetExternalId) {
      throw new BadRequestException('This conversation cannot be replied to');
    }

    if (clientRequestId) {
      const existing = await this.prisma.socialInboxMessage.findFirst({
        where: { conversationId, clientRequestId },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.socialInboxMessage.create({
        data: {
          conversationId,
          clientRequestId,
          direction: 'OUTBOUND',
          status: 'PENDING',
          text,
          senderExternalId: conversation.integration.internalId,
          replyToExternalId:
            conversation.platform === 'THREADS'
              ? conversation.replyTargetExternalId
              : undefined,
        },
      });
      await transaction.socialInboxConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.sentAt },
      });
      return message;
    });
  }

  async sendMessage(messageId: string) {
    const message = await this.prisma.socialInboxMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: { include: { integration: true } },
      },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (['SENT', 'DELIVERED', 'READ'].includes(message.status)) return message;

    const adapter = this.adapters.find(
      (candidate) =>
        candidate.platform === message.conversation.platform &&
        candidate.supports(message.conversation.integration.providerIdentifier)
    );
    if (!adapter) throw new BadRequestException('Messaging is not supported');

    try {
      const result = await adapter.send({
        conversation: message.conversation,
        message,
      });
      const sentAt = result.sentAt || new Date();
      return await this.prisma.$transaction(async (transaction) => {
        const sent = await transaction.socialInboxMessage.update({
          where: { id: message.id },
          data: {
            externalId: result.externalId,
            sentAt,
            status: 'SENT',
            error: null,
          },
        });
        await transaction.socialInboxConversation.update({
          where: { id: message.conversationId },
          data: {
            lastMessageAt: sentAt,
            ...(message.conversation.platform === 'THREADS'
              ? { replyTargetExternalId: result.externalId }
              : {}),
          },
        });
        return sent;
      });
    } catch (error) {
      await this.prisma.socialInboxMessage.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Message failed',
        },
      });
      throw error;
    }
  }

  async prepareRetry(organizationId: string, messageId: string) {
    const message = await this.prisma.socialInboxMessage.findFirst({
      where: {
        id: messageId,
        status: 'FAILED',
        conversation: { organizationId },
      },
    });
    if (!message) throw new NotFoundException('Failed message not found');
    return this.prisma.socialInboxMessage.update({
      where: { id: messageId },
      data: { status: 'PENDING', error: null },
    });
  }

  async processMetaWebhook(
    receiptId: string,
    platform: MetaWebhookPlatform,
    payload: Record<string, unknown>
  ) {
    const existing = await this.prisma.socialWebhookReceipt.findUnique({
      where: { id: receiptId },
    });
    if (existing) return { duplicate: true };

    try {
      await this.prisma.socialWebhookReceipt.create({
        data: { id: receiptId, platform },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicate: true };
      }
      throw error;
    }

    try {
      for (const event of normalizeMetaWebhook(platform, payload)) {
        if (event.type === 'message') {
          await this.ingestMetaMessage(platform, event.data);
        } else {
          await this.applyMetaStatus(platform, event.data);
        }
      }
      return { success: true };
    } catch (error) {
      await this.prisma.socialWebhookReceipt.delete({
        where: { id: receiptId },
      });
      throw error;
    }
  }

  async syncAll(organizationId?: string) {
    await this.prisma.socialWebhookReceipt.deleteMany({
      where: {
        processedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    const meta = await this.syncMetaConversations(organizationId);
    const threads = await this.syncThreadsReplies(organizationId);
    return { meta, threads };
  }

  async syncMetaConversations(organizationId?: string) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        providerIdentifier: {
          in: ['facebook', 'instagram', 'instagram-standalone'],
        },
        ...(organizationId ? { organizationId } : {}),
        disabled: false,
        deletedAt: null,
      },
    });
    let imported = 0;
    const errors: { integrationId: string; message: string }[] = [];

    for (const integration of integrations) {
      const syncState = await this.prisma.socialInboxSyncState.findUnique({
        where: { integrationId: integration.id },
      });
      const syncStartedAt = new Date();
      try {
        imported += await this.syncMetaIntegration(
          integration,
          Boolean(syncState?.initialSyncCompleted),
          syncState?.lastSyncedAt
        );
        await this.markIntegrationSynced(integration.id, syncStartedAt);
      } catch (error) {
        errors.push({
          integrationId: integration.id,
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    return { imported, errors };
  }

  async syncThreadsReplies(organizationId?: string) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        providerIdentifier: 'threads',
        ...(organizationId ? { organizationId } : {}),
        disabled: false,
        deletedAt: null,
      },
      include: {
        posts: {
          where: {
            releaseId: { not: null },
            deletedAt: null,
            state: 'PUBLISHED',
          },
          select: { id: true, releaseId: true },
        },
      },
    });

    let imported = 0;
    const errors: { integrationId: string; message: string }[] = [];
    for (const integration of integrations) {
      const syncState = await this.prisma.socialInboxSyncState.findUnique({
        where: { integrationId: integration.id },
      });
      try {
        const syncedPostIds = new Set<string>();
        for (const post of integration.posts) {
          if (!post.releaseId || syncedPostIds.has(post.releaseId)) continue;
          syncedPostIds.add(post.releaseId);
          imported += await this.syncThreadsPost(
            integration,
            post,
            Boolean(syncState?.initialSyncCompleted)
          );
        }
        await this.markIntegrationSynced(integration.id);
      } catch (error) {
        errors.push({
          integrationId: integration.id,
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    return { imported, errors };
  }

  getCapabilities(organizationId: string) {
    return this.prisma.integration.findMany({
      where: {
        organizationId,
        providerIdentifier: { in: inboxProviders },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        picture: true,
        providerIdentifier: true,
        disabled: true,
        refreshNeeded: true,
        inBetweenSteps: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private assertConversation(organizationId: string, id: string) {
    return this.prisma.socialInboxConversation
      .findFirst({
        where: { id, organizationId },
        include: { integration: true },
      })
      .then((conversation) => {
        if (!conversation)
          throw new NotFoundException('Conversation not found');
        return conversation;
      });
  }

  private markIntegrationSynced(integrationId: string, syncedAt = new Date()) {
    return this.prisma.socialInboxSyncState.upsert({
      where: { integrationId },
      create: {
        integrationId,
        initialSyncCompleted: true,
        lastSyncedAt: syncedAt,
      },
      update: { initialSyncCompleted: true, lastSyncedAt: syncedAt },
    });
  }

  private async syncMetaIntegration(
    integration: Integration,
    markUnread: boolean,
    since?: Date | null
  ) {
    const platform: MetaWebhookPlatform =
      integration.providerIdentifier === 'facebook' ? 'FACEBOOK' : 'INSTAGRAM';
    const host =
      integration.providerIdentifier === 'instagram-standalone'
        ? 'graph.instagram.com'
        : 'graph.facebook.com';
    const params = new URLSearchParams({
      fields: 'id,participants,updated_time',
      limit: '50',
      access_token: integration.token,
      ...(platform === 'INSTAGRAM' ? { platform: 'instagram' } : {}),
    });
    let nextUrl:
      | string
      | undefined = `https://${host}/${getMetaGraphVersion()}/${
      integration.internalId
    }/conversations?${params}`;
    let page = 0;
    let imported = 0;

    while (nextUrl && page < 5) {
      const payload = await this.fetchGraphPage(nextUrl, 'Meta inbox sync');
      for (const conversation of payload.data || []) {
        if (
          since &&
          conversation.updated_time &&
          new Date(conversation.updated_time).getTime() <= since.getTime()
        ) {
          continue;
        }
        imported += await this.syncMetaConversation(
          integration,
          platform,
          host,
          conversation,
          markUnread
        );
      }
      nextUrl = payload.paging?.next;
      page++;
    }
    return imported;
  }

  private async syncMetaConversation(
    integration: Integration,
    platform: MetaWebhookPlatform,
    host: string,
    conversation: any,
    markUnread: boolean
  ) {
    const participant = (conversation.participants?.data || []).find(
      (item: any) => String(item.id) !== integration.internalId
    );
    const params = new URLSearchParams({
      fields: 'id,created_time,from,to,message,attachments',
      limit: '100',
      access_token: integration.token,
    });
    let nextUrl:
      | string
      | undefined = `https://${host}/${getMetaGraphVersion()}/${
      conversation.id
    }/messages?${params}`;
    let page = 0;
    const messages: any[] = [];

    while (nextUrl && page < 5) {
      const payload = await this.fetchGraphPage(nextUrl, 'Meta message sync');
      messages.push(...(payload.data || []));
      nextUrl = payload.paging?.next;
      page++;
    }
    messages.sort(
      (left, right) =>
        new Date(left.created_time || 0).getTime() -
        new Date(right.created_time || 0).getTime()
    );

    let imported = 0;
    for (const message of messages) {
      const direction =
        String(message.from?.id) === integration.internalId
          ? 'OUTBOUND'
          : 'INBOUND';
      const contactExternalId = String(
        participant?.id ||
          (direction === 'INBOUND'
            ? message.from?.id
            : message.to?.data?.find(
                (item: any) => String(item.id) !== integration.internalId
              )?.id) ||
          ''
      );
      if (!message.id || !contactExternalId) continue;

      const existed = await this.prisma.socialInboxMessage.findFirst({
        where: {
          externalId: String(message.id),
          conversation: { integrationId: integration.id },
        },
        select: { id: true },
      });
      await this.ingestMetaMessage(
        platform,
        {
          accountExternalId: integration.internalId,
          contactExternalId,
          externalId: String(message.id),
          direction,
          text: message.message,
          senderExternalId: message.from?.id
            ? String(message.from.id)
            : undefined,
          sentAt: new Date(message.created_time || Date.now()),
          attachments: this.normalizeGraphAttachments(
            message.attachments?.data
          ),
          rawPayload: message,
        },
        markUnread,
        integration.id
      );
      if (!existed) imported++;
    }
    return imported;
  }

  private normalizeGraphAttachments(attachments: any[] = []) {
    return attachments.map((attachment) => ({
      externalId: attachment.id ? String(attachment.id) : undefined,
      type: attachment.image_data
        ? 'image'
        : attachment.video_data
        ? 'video'
        : attachment.file_url
        ? 'file'
        : attachment.mime_type || 'file',
      url:
        attachment.image_data?.url ||
        attachment.video_data?.url ||
        attachment.file_url ||
        attachment.url,
      name: attachment.name,
    }));
  }

  private async fetchGraphPage(url: string, label: string) {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(
        payload?.error?.message || `${label} failed (${response.status})`
      );
    }
    return payload;
  }

  private async findMetaIntegrations(
    platform: MetaWebhookPlatform,
    accountExternalId: string,
    integrationId?: string
  ) {
    return this.prisma.integration.findMany({
      where: {
        internalId: accountExternalId,
        ...(integrationId ? { id: integrationId } : {}),
        disabled: false,
        deletedAt: null,
        providerIdentifier:
          platform === 'FACEBOOK'
            ? 'facebook'
            : { in: ['instagram', 'instagram-standalone'] },
      },
    });
  }

  private async ingestMetaMessage(
    platform: MetaWebhookPlatform,
    event: NormalizedMetaMessage,
    markUnread = true,
    integrationId?: string
  ) {
    const integrations = await this.findMetaIntegrations(
      platform,
      event.accountExternalId,
      integrationId
    );

    for (const integration of integrations) {
      const knownContact = await this.prisma.socialInboxContact.findUnique({
        where: {
          integrationId_externalId: {
            integrationId: integration.id,
            externalId: event.contactExternalId,
          },
        },
      });
      const profile = knownContact
        ? undefined
        : await this.fetchMetaContact(
            platform,
            integration.token,
            event.contactExternalId,
            integration.providerIdentifier
          ).catch(() => undefined);
      const contact = await this.prisma.socialInboxContact.upsert({
        where: {
          integrationId_externalId: {
            integrationId: integration.id,
            externalId: event.contactExternalId,
          },
        },
        create: {
          organizationId: integration.organizationId,
          integrationId: integration.id,
          platform,
          externalId: event.contactExternalId,
          name:
            profile?.name ||
            `${platform === 'FACEBOOK' ? 'Facebook' : 'Instagram'} user`,
          username: profile?.username,
          avatarUrl: profile?.avatarUrl,
        },
        update: profile
          ? {
              name: profile.name,
              username: profile.username,
              avatarUrl: profile.avatarUrl,
            }
          : {},
      });
      const conversation = await this.prisma.socialInboxConversation.upsert({
        where: {
          integrationId_externalId: {
            integrationId: integration.id,
            externalId: `dm:${event.contactExternalId}`,
          },
        },
        create: {
          organizationId: integration.organizationId,
          integrationId: integration.id,
          contactId: contact.id,
          platform,
          externalId: `dm:${event.contactExternalId}`,
          replyTargetExternalId: event.contactExternalId,
          lastMessageAt: event.sentAt,
        },
        update: {
          replyTargetExternalId: event.contactExternalId,
        },
      });

      const existing = await this.prisma.socialInboxMessage.findUnique({
        where: {
          conversationId_externalId: {
            conversationId: conversation.id,
            externalId: event.externalId,
          },
        },
      });
      if (existing) continue;

      if (event.direction === 'OUTBOUND') {
        const pending = await this.prisma.socialInboxMessage.findFirst({
          where: {
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            externalId: null,
            text: event.text,
            sentAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          orderBy: { sentAt: 'desc' },
        });
        if (pending) {
          await this.prisma.$transaction([
            this.prisma.socialInboxMessage.update({
              where: { id: pending.id },
              data: {
                externalId: event.externalId,
                status: 'SENT',
                sentAt: event.sentAt,
                rawPayload: event.rawPayload as Prisma.InputJsonValue,
              },
            }),
            this.prisma.socialInboxConversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: event.sentAt },
            }),
          ]);
          continue;
        }
      }

      try {
        await this.prisma.$transaction(async (transaction) => {
          await transaction.socialInboxMessage.create({
            data: {
              conversationId: conversation.id,
              externalId: event.externalId,
              direction: event.direction,
              status: event.direction === 'OUTBOUND' ? 'SENT' : 'DELIVERED',
              text: event.text,
              senderExternalId: event.senderExternalId,
              replyToExternalId: event.replyToExternalId,
              sentAt: event.sentAt,
              rawPayload: event.rawPayload as Prisma.InputJsonValue,
              attachments: {
                create: event.attachments.map((attachment) => ({
                  externalId: attachment.externalId,
                  type: attachment.type,
                  url: attachment.url,
                  name: attachment.name,
                })),
              },
            },
          });
          await transaction.socialInboxConversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: event.sentAt,
              ...(event.direction === 'INBOUND' && markUnread
                ? { unreadCount: { increment: 1 }, status: 'OPEN' }
                : event.direction === 'INBOUND'
                ? { status: 'OPEN' }
                : {}),
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async applyMetaStatus(
    platform: MetaWebhookPlatform,
    event: NormalizedMetaStatus
  ) {
    const integrations = await this.findMetaIntegrations(
      platform,
      event.accountExternalId
    );
    for (const integration of integrations) {
      await this.prisma.socialInboxMessage.updateMany({
        where: {
          conversation: { integrationId: integration.id },
          direction: 'OUTBOUND',
          ...(event.externalIds?.length
            ? { externalId: { in: event.externalIds } }
            : event.watermark
            ? { sentAt: { lte: event.watermark } }
            : { id: '__none__' }),
          ...(event.status === 'DELIVERED' ? { status: { not: 'READ' } } : {}),
        },
        data: { status: event.status },
      });
    }
  }

  private async fetchMetaContact(
    platform: MetaWebhookPlatform,
    accessToken: string,
    externalId: string,
    providerIdentifier: string
  ) {
    const host =
      providerIdentifier === 'instagram-standalone'
        ? 'graph.instagram.com'
        : 'graph.facebook.com';
    const fields =
      platform === 'FACEBOOK'
        ? 'first_name,last_name,profile_pic'
        : 'name,username,profile_pic';
    const response = await fetch(
      `https://${host}/${
        process.env.META_GRAPH_VERSION || 'v25.0'
      }/${externalId}` +
        `?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
    );
    const profile = await response.json();
    if (!response.ok || profile.error) throw new Error('Profile lookup failed');
    return {
      name:
        profile.name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        profile.username,
      username: profile.username,
      avatarUrl: profile.profile_pic,
    };
  }

  private async syncThreadsPost(
    integration: Integration,
    post: { id: string; releaseId: string | null },
    markUnread: boolean
  ) {
    if (!post.releaseId) return 0;
    let nextUrl: string | undefined =
      `https://graph.threads.net/v1.0/${post.releaseId}/replies` +
      `?fields=id,text,username,timestamp,permalink,replied_to,root_post` +
      `&limit=100&access_token=${encodeURIComponent(integration.token)}`;
    let imported = 0;
    let page = 0;

    while (nextUrl && page < 5) {
      const response = await fetch(nextUrl);
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(
          payload?.error?.message || `Threads sync failed (${response.status})`
        );
      }
      const replies = [...(payload.data || [])].sort(
        (left: any, right: any) =>
          new Date(left.timestamp || 0).getTime() -
          new Date(right.timestamp || 0).getTime()
      );
      for (const reply of replies) {
        if (
          !reply.id ||
          !reply.username ||
          reply.username === integration.profile
        ) {
          continue;
        }
        if (await this.ingestThreadsReply(integration, post, reply, markUnread))
          imported++;
      }
      nextUrl = payload.paging?.next;
      page++;
    }
    return imported;
  }

  private async ingestThreadsReply(
    integration: Integration,
    post: { id: string; releaseId: string | null },
    reply: any,
    markUnread: boolean
  ) {
    const externalContactId = String(reply.username);
    const contact = await this.prisma.socialInboxContact.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId: externalContactId,
        },
      },
      create: {
        organizationId: integration.organizationId,
        integrationId: integration.id,
        platform: 'THREADS',
        externalId: externalContactId,
        name: reply.username,
        username: reply.username,
      },
      update: { name: reply.username, username: reply.username },
    });
    const conversation = await this.prisma.socialInboxConversation.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId: `thread:${post.releaseId}:${externalContactId}`,
        },
      },
      create: {
        organizationId: integration.organizationId,
        integrationId: integration.id,
        contactId: contact.id,
        platform: 'THREADS',
        externalId: `thread:${post.releaseId}:${externalContactId}`,
        rootExternalId: post.releaseId,
        replyTargetExternalId: String(reply.id),
        relatedPostId: post.id,
        lastMessageAt: new Date(reply.timestamp || Date.now()),
      },
      update: {
        contactId: contact.id,
      },
    });
    const existing = await this.prisma.socialInboxMessage.findUnique({
      where: {
        conversationId_externalId: {
          conversationId: conversation.id,
          externalId: String(reply.id),
        },
      },
    });
    if (existing) return false;

    await this.prisma.$transaction([
      this.prisma.socialInboxMessage.create({
        data: {
          conversationId: conversation.id,
          externalId: String(reply.id),
          direction: 'INBOUND',
          status: 'DELIVERED',
          text: reply.text,
          senderExternalId: externalContactId,
          replyToExternalId: reply.replied_to?.id || post.releaseId,
          sentAt: new Date(reply.timestamp || Date.now()),
          rawPayload: reply as Prisma.InputJsonValue,
        },
      }),
      this.prisma.socialInboxConversation.update({
        where: { id: conversation.id },
        data: {
          ...(markUnread ? { unreadCount: { increment: 1 } } : {}),
          status: 'OPEN',
          replyTargetExternalId: String(reply.id),
          lastMessageAt: new Date(reply.timestamp || Date.now()),
        },
      }),
    ]);
    return true;
  }
}
