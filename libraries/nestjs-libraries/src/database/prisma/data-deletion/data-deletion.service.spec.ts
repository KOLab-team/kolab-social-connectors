import { createHmac } from 'crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { DataDeletionService } from './data-deletion.service';

function sign(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${signature}.${encodedPayload}`;
}

describe('DataDeletionService', () => {
  const originalThreadsSecret = process.env.THREADS_APP_SECRET;

  afterEach(() => {
    if (originalThreadsSecret === undefined) {
      delete process.env.THREADS_APP_SECRET;
    } else {
      process.env.THREADS_APP_SECRET = originalThreadsSecret;
    }
  });

  it('accepts a deletion request signed by the Threads app', async () => {
    process.env.THREADS_APP_SECRET = 'threads-test-secret';

    const prisma = {
      integration: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'threads-integration-id' }]),
      },
      dataDeletionRequest: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'deletion-request-id',
          ...data,
        })),
      },
    } as unknown as PrismaService;
    const service = new DataDeletionService(prisma);
    const signedRequest = sign(
      {
        algorithm: 'HMAC-SHA256',
        user_id: 'threads-user-id',
      },
      'threads-test-secret'
    );

    await expect(service.prepareMetaRequest(signedRequest)).resolves.toEqual(
      expect.objectContaining({
        id: 'deletion-request-id',
        integrationIds: ['threads-integration-id'],
        completed: false,
      })
    );
    expect(prisma.integration.findMany).toHaveBeenCalledWith({
      where: {
        rootInternalId: 'threads-user-id',
        providerIdentifier: { in: ['threads'] },
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'THREADS',
        integrationCount: 1,
      }),
    });
  });
});
