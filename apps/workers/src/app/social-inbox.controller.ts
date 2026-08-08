import { Controller } from '@nestjs/common';
import { EventPattern, Transport } from '@nestjs/microservices';
import { SocialInboxService } from '@gitroom/nestjs-libraries/database/prisma/social-inbox/social-inbox.service';
import { MetaWebhookPlatform } from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';
import { DataDeletionService } from '@gitroom/nestjs-libraries/database/prisma/data-deletion/data-deletion.service';

@Controller()
export class SocialInboxWorkerController {
  constructor(
    private readonly socialInbox: SocialInboxService,
    private readonly dataDeletion: DataDeletionService
  ) {}

  @EventPattern('social-inbox-webhook', Transport.REDIS)
  processWebhook(data: {
    receiptId: string;
    platform: MetaWebhookPlatform;
    body: Record<string, unknown>;
  }) {
    return this.socialInbox.processMetaWebhook(
      data.receiptId,
      data.platform,
      data.body
    );
  }

  @EventPattern('social-inbox-send', Transport.REDIS)
  send(data: { messageId: string }) {
    return this.socialInbox.sendMessage(data.messageId);
  }

  @EventPattern('social-inbox-sync', Transport.REDIS)
  sync(data: { organizationId?: string }) {
    return this.socialInbox.syncAll(data.organizationId);
  }

  @EventPattern('meta-data-deletion', Transport.REDIS)
  deleteMetaData(data: { requestId: string; integrationIds: string[] }) {
    return this.dataDeletion.processMetaRequest(
      data.requestId,
      data.integrationIds
    );
  }
}
