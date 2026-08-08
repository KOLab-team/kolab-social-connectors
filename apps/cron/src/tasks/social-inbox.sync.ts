import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';

@Injectable()
export class SocialInboxSync {
  constructor(private readonly worker: BullMqClient) {}

  @Cron('*/5 * * * *')
  handleCron() {
    return this.worker.dispatchEvent({
      pattern: 'social-inbox-sync',
      data: {
        id: 'social-inbox-sync',
        options: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        payload: {},
      },
    });
  }
}
