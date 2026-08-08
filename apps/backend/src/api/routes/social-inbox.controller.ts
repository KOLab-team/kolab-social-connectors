import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { SocialInboxService } from '@gitroom/nestjs-libraries/database/prisma/social-inbox/social-inbox.service';
import {
  AddSocialInboxNoteDto,
  SendSocialInboxMessageDto,
  SocialInboxQueryDto,
  UpdateSocialConversationDto,
} from '@gitroom/nestjs-libraries/dtos/social-inbox/social-inbox.dto';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';

@ApiTags('Social inbox')
@Controller('/social-inbox')
export class SocialInboxController {
  constructor(
    private readonly socialInbox: SocialInboxService,
    private readonly worker: BullMqClient
  ) {}

  @Get('/conversations')
  list(
    @GetOrgFromRequest() organization: Organization,
    @Query() query: SocialInboxQueryDto
  ) {
    return this.socialInbox.listConversations(organization.id, query);
  }

  @Get('/conversations/:id')
  get(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    return this.socialInbox.getConversation(organization.id, id);
  }

  @Patch('/conversations/:id')
  setStatus(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() body: UpdateSocialConversationDto
  ) {
    return this.socialInbox.setStatus(organization.id, id, body.status);
  }

  @Post('/conversations/:id/messages')
  async send(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() body: SendSocialInboxMessageDto
  ) {
    const message = await this.socialInbox.createPendingMessage(
      organization.id,
      id,
      body.text.trim(),
      body.clientRequestId
    );
    await this.queueMessage(message.id);
    return message;
  }

  @Post('/conversations/:id/notes')
  note(
    @GetOrgFromRequest() organization: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: AddSocialInboxNoteDto
  ) {
    return this.socialInbox.addNote(
      organization.id,
      id,
      user.id,
      body.content.trim()
    );
  }

  @Post('/messages/:id/retry')
  async retry(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    const message = await this.socialInbox.prepareRetry(organization.id, id);
    await this.queueMessage(message.id);
    return message;
  }

  @Post('/sync')
  async sync(@GetOrgFromRequest() organization: Organization) {
    await this.worker.dispatchEvent({
      pattern: 'social-inbox-sync',
      data: {
        id: `social-inbox-sync-${organization.id}`,
        options: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        payload: { organizationId: organization.id },
      },
    });
    return { queued: true };
  }

  @Get('/capabilities')
  capabilities(@GetOrgFromRequest() organization: Organization) {
    return this.socialInbox.getCapabilities(organization.id);
  }

  private queueMessage(messageId: string) {
    return this.worker.dispatchEvent({
      pattern: 'social-inbox-send',
      data: {
        id: `social-inbox-send-${messageId}`,
        options: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
        payload: { messageId },
      },
    });
  }
}
