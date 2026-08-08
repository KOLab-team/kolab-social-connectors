import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { verifyMetaSignedRequest } from '@gitroom/nestjs-libraries/social-inbox/meta-signed-request';

type CredentialSource = {
  name: string;
  secret: string;
  providers: string[];
};

@Injectable()
export class DataDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareMetaRequest(signedRequest: string) {
    const sources = this.credentialSources();
    const match = sources
      .map((source) => ({
        source,
        payload: verifyMetaSignedRequest(signedRequest, source.secret),
      }))
      .find(({ payload }) => payload?.user_id !== undefined);

    if (!match?.payload?.user_id) {
      throw new ForbiddenException('Invalid Meta data deletion request');
    }

    const externalUserId = String(match.payload.user_id);
    const integrations = await this.prisma.integration.findMany({
      where: {
        rootInternalId: externalUserId,
        providerIdentifier: { in: match.source.providers },
        deletedAt: null,
      },
      select: { id: true },
    });
    const integrationIds = integrations.map(({ id }) => id);
    const confirmationCode = randomBytes(18).toString('hex');
    const completed = integrationIds.length === 0;
    const request = await this.prisma.dataDeletionRequest.create({
      data: {
        confirmationCode,
        source: match.source.name,
        subjectHash: this.hashSubject(externalUserId, match.source.secret),
        integrationCount: integrationIds.length,
        ...(completed ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });

    return {
      id: request.id,
      confirmationCode,
      integrationIds,
      completed,
    };
  }

  async processMetaRequest(requestId: string, integrationIds: string[]) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    if (request.status === 'COMPLETED') return request;

    await this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING', error: null },
    });

    try {
      const deletedAt = new Date();
      await this.prisma.$transaction(async (transaction) => {
        if (integrationIds.length) {
          await transaction.socialInboxConversation.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.socialInboxContact.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.socialInboxSyncState.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.integrationsWebhooks.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.exisingPlugData.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.plugs.deleteMany({
            where: { integrationId: { in: integrationIds } },
          });
          await transaction.post.updateMany({
            where: { integrationId: { in: integrationIds } },
            data: {
              content: '',
              title: '',
              description: null,
              settings: null,
              image: null,
              releaseId: null,
              releaseURL: null,
              error: null,
              deletedAt,
            },
          });

          for (const integrationId of integrationIds) {
            await transaction.integration.updateMany({
              where: { id: integrationId },
              data: {
                internalId: `deleted:${requestId}:${integrationId}`,
                rootInternalId: null,
                name: 'Deleted Meta integration',
                picture: null,
                token: '',
                refreshToken: null,
                tokenExpiration: null,
                profile: null,
                customInstanceDetails: null,
                additionalSettings: '[]',
                inBetweenSteps: false,
                refreshNeeded: true,
                disabled: true,
                deletedAt,
              },
            });
          }
        }

        await transaction.dataDeletionRequest.update({
          where: { id: requestId },
          data: {
            status: 'COMPLETED',
            completedAt: deletedAt,
            error: null,
          },
        });
      });
    } catch (error) {
      await this.prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'FAILED',
          error: 'Deletion processing failed',
        },
      });
      throw error;
    }

    return this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
    });
  }

  async getPublicStatus(confirmationCode: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { confirmationCode },
      select: {
        confirmationCode: true,
        status: true,
        requestedAt: true,
        completedAt: true,
      },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    return request;
  }

  statusUrl(confirmationCode: string) {
    const frontend = (
      process.env.FRONTEND_URL ||
      process.env.MAIN_URL ||
      ''
    ).replace(/\/$/, '');
    if (!frontend) throw new Error('FRONTEND_URL is not configured');
    return `${frontend}/data-deletion?code=${encodeURIComponent(
      confirmationCode
    )}`;
  }

  private credentialSources(): CredentialSource[] {
    return [
      {
        name: 'FACEBOOK',
        secret: process.env.FACEBOOK_APP_SECRET || '',
        providers: ['facebook', 'instagram'],
      },
      {
        name: 'FACEBOOK_LEGACY',
        secret: process.env.FACEBOOK_LEGACY_APP_SECRET || '',
        providers: ['facebook', 'instagram'],
      },
      {
        name: 'INSTAGRAM',
        secret: process.env.INSTAGRAM_APP_SECRET || '',
        providers: ['instagram-standalone'],
      },
      {
        name: 'INSTAGRAM_LEGACY',
        secret: process.env.INSTAGRAM_LEGACY_APP_SECRET || '',
        providers: ['instagram-standalone'],
      },
    ].filter((source) => source.secret);
  }

  private hashSubject(externalUserId: string, fallbackSecret: string) {
    const secret =
      process.env.META_DATA_DELETION_HASH_SECRET ||
      process.env.JWT_SECRET ||
      fallbackSecret;
    return createHmac('sha256', secret).update(externalUserId).digest('hex');
  }
}
