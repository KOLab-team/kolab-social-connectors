import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';
import { verifyMetaWebhookSignature } from '@gitroom/nestjs-libraries/social-inbox/meta-webhook';
import { MetaWebhookPlatform } from '@gitroom/nestjs-libraries/social-inbox/social-inbox.types';

@SkipThrottle()
@ApiExcludeController()
@Controller('/social-inbox/webhooks')
export class MetaInboxWebhooksController {
  constructor(private readonly worker: BullMqClient) {}

  @Get('/:platform')
  verify(
    @Param('platform') platform: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() response: Response
  ) {
    this.toPlatform(platform);
    if (
      mode !== 'subscribe' ||
      !process.env.META_WEBHOOK_VERIFY_TOKEN ||
      token !== process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return response.status(200).send(challenge);
  }

  @Post('/:platform')
  async receive(
    @Param('platform') value: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>
  ) {
    const platform = this.toPlatform(value);
    const rawBody = request.rawBody;
    if (!rawBody) throw new BadRequestException('Raw webhook body unavailable');

    const secrets =
      platform === 'FACEBOOK'
        ? [process.env.FACEBOOK_APP_SECRET || '']
        : [
            process.env.INSTAGRAM_APP_SECRET || '',
            process.env.FACEBOOK_APP_SECRET || '',
          ];
    if (!verifyMetaWebhookSignature(rawBody, signature, secrets)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const receiptId = createHash('sha256')
      .update(platform)
      .update(rawBody)
      .digest('hex');
    await this.worker.dispatchEvent({
      pattern: 'social-inbox-webhook',
      data: {
        id: receiptId,
        options: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
        payload: { receiptId, platform, body: request.body },
      },
    });
    return { received: true };
  }

  private toPlatform(value: string): MetaWebhookPlatform {
    if (value === 'facebook') return 'FACEBOOK';
    if (value === 'instagram') return 'INSTAGRAM';
    throw new BadRequestException('Unsupported webhook platform');
  }
}
