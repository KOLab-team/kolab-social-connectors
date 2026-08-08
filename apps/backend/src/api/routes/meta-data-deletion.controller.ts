import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';
import { DataDeletionService } from '@gitroom/nestjs-libraries/database/prisma/data-deletion/data-deletion.service';

@ApiExcludeController()
@Controller('/meta/data-deletion')
export class MetaDataDeletionController {
  constructor(
    private readonly dataDeletion: DataDeletionService,
    private readonly worker: BullMqClient
  ) {}

  @Post()
  async requestDeletion(@Body('signed_request') signedRequest?: string) {
    if (!signedRequest) {
      throw new BadRequestException('signed_request is required');
    }

    const request = await this.dataDeletion.prepareMetaRequest(signedRequest);
    if (!request.completed) {
      await this.worker.dispatchEvent({
        pattern: 'meta-data-deletion',
        data: {
          id: `meta-data-deletion-${request.id}`,
          options: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
          },
          payload: {
            requestId: request.id,
            integrationIds: request.integrationIds,
          },
        },
      });
    }

    return {
      url: this.dataDeletion.statusUrl(request.confirmationCode),
      confirmation_code: request.confirmationCode,
    };
  }

  @Get('/:confirmationCode')
  status(@Param('confirmationCode') confirmationCode: string) {
    return this.dataDeletion.getPublicStatus(confirmationCode);
  }
}
