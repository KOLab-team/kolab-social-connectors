import {
  AgentToolInterface,
  ToolReturn,
} from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { State } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod';

dayjs.extend(utc);

const postStateSchema = z.enum(['QUEUE', 'PUBLISHED', 'ERROR', 'DRAFT']);

const toolOutputSchema = z.object({
  output: z.any().optional(),
  error: z.string().optional(),
});

function getOrganizationId(runtimeContext: any): string {
  return JSON.parse(runtimeContext.get('organization' as never) as string).id;
}

function parseJson(value: any, fallback: any) {
  if (!value) {
    return fallback;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function stripHtml(value: string | null | undefined) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentPreview(value: string | null | undefined) {
  const text = stripHtml(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function orderedMedia(post: any) {
  return (parseJson(post?.image, []) || []).map((item: any, index: number) => ({
    index,
    id: item?.id || null,
    path: item?.path || item?.url || item || null,
  }));
}

function integrationSummary(integration: any) {
  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    name: integration.name,
    platform: integration.providerIdentifier,
    picture: integration.picture || null,
  };
}

function postSummary(post: any) {
  return {
    id: post.id,
    group: post.group,
    state: post.state,
    publishDate: post.publishDate,
    releaseURL: post.releaseURL || null,
    intervalInDays: post.intervalInDays || null,
    integration: integrationSummary(post.integration),
    tags: (post.tags || []).map((tag: any) => tag.tag?.name).filter(Boolean),
    contentPreview: contentPreview(post.content),
  };
}

function postDetails(post: any) {
  return {
    ...postSummary(post),
    parentPostId: post.parentPostId || null,
    content: post.content,
    plainText: stripHtml(post.content),
    settings: parseJson(post.settings, {}),
    media: orderedMedia(post),
    error: post.error || null,
  };
}

async function loadPostThread(
  postsService: PostsService,
  organizationId: string,
  postId: string
) {
  return postsService.getPostsRecursively(postId, true, organizationId, true);
}

@Injectable()
export class PostizListPostsTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postizListPostsTool';

  run(): ToolReturn {
    return createTool({
      id: 'postizListPostsTool',
      description:
        'List Postiz posts for the authenticated organization, including scheduled, draft, published, and error posts. Useful before inspecting, cancelling, or comparing scheduled social posts.',
      inputSchema: z.object({
        startDate: z
          .string()
          .optional()
          .describe(
            'Start of the publish date range in ISO/UTC. Defaults to 7 days ago.'
          ),
        endDate: z
          .string()
          .optional()
          .describe(
            'End of the publish date range in ISO/UTC. Defaults to 30 days from now.'
          ),
        state: postStateSchema.optional().describe('Optional Postiz state'),
        integrationId: z
          .string()
          .optional()
          .describe('Optional Postiz integration id filter'),
        platform: z
          .string()
          .optional()
          .describe('Optional platform filter, such as threads or instagram'),
        customer: z
          .string()
          .optional()
          .describe('Optional Postiz customer id filter'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Maximum number of posts to return. Defaults to 50.'),
      }),
      outputSchema: toolOutputSchema,
      execute: async (args, options) => {
        const { context, runtimeContext } = args;
        checkAuth(args, options);
        const organizationId = getOrganizationId(runtimeContext);
        const startDate =
          context.startDate || dayjs.utc().subtract(7, 'day').toISOString();
        const endDate =
          context.endDate || dayjs.utc().add(30, 'day').toISOString();
        const limit = context.limit || 50;

        const posts = await this._postsService.getPosts(organizationId, {
          startDate,
          endDate,
          customer: context.customer || '',
        });

        const filtered = posts
          .filter((post: any) =>
            context.state ? post.state === context.state : true
          )
          .filter((post: any) =>
            context.integrationId
              ? post.integration?.id === context.integrationId
              : true
          )
          .filter((post: any) =>
            context.platform
              ? post.integration?.providerIdentifier === context.platform
              : true
          )
          .slice(0, limit)
          .map(postSummary);

        return {
          output: {
            startDate,
            endDate,
            count: filtered.length,
            posts: filtered,
          },
        };
      },
    });
  }
}

@Injectable()
export class PostizGetPostTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postizGetPostTool';

  run(): ToolReturn {
    return createTool({
      id: 'postizGetPostTool',
      description:
        'Get a Postiz post/thread by id for the authenticated organization, including content, settings, integration, media order, and child posts/comments.',
      inputSchema: z.object({
        postId: z.string().describe('The Postiz post id to inspect'),
      }),
      outputSchema: toolOutputSchema,
      execute: async (args, options) => {
        const { context, runtimeContext } = args;
        checkAuth(args, options);
        const organizationId = getOrganizationId(runtimeContext);
        const posts = await loadPostThread(
          this._postsService,
          organizationId,
          context.postId
        );

        if (!posts.length) {
          return {
            error: 'Post not found for this organization',
          };
        }

        return {
          output: {
            group: posts[0].group,
            integration: integrationSummary(posts[0].integration),
            posts: posts.map(postDetails),
          },
        };
      },
    });
  }
}

@Injectable()
export class PostizInspectMediaOrderTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postizInspectMediaOrderTool';

  run(): ToolReturn {
    return createTool({
      id: 'postizInspectMediaOrderTool',
      description:
        'Inspect the exact media order stored by Postiz for a post/thread. Use this to diagnose carousel ordering before publishing.',
      inputSchema: z.object({
        postId: z.string().describe('The Postiz post id to inspect'),
      }),
      outputSchema: toolOutputSchema,
      execute: async (args, options) => {
        const { context, runtimeContext } = args;
        checkAuth(args, options);
        const organizationId = getOrganizationId(runtimeContext);
        const posts = await loadPostThread(
          this._postsService,
          organizationId,
          context.postId
        );

        if (!posts.length) {
          return {
            error: 'Post not found for this organization',
          };
        }

        return {
          output: {
            group: posts[0].group,
            posts: posts.map((post: any, postIndex: number) => ({
              postIndex,
              postId: post.id,
              state: post.state,
              publishDate: post.publishDate,
              media: orderedMedia(post),
            })),
          },
        };
      },
    });
  }
}

@Injectable()
export class PostizCancelQueuedPostTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postizCancelQueuedPostTool';

  run(): ToolReturn {
    return createTool({
      id: 'postizCancelQueuedPostTool',
      description:
        'Cancel a queued or draft Postiz post/thread for the authenticated organization. This refuses published/error posts and removes the scheduled worker job through Postiz.',
      inputSchema: z.object({
        postId: z.string().describe('The root Postiz post id to cancel'),
      }),
      outputSchema: toolOutputSchema,
      execute: async (args, options) => {
        const { context, runtimeContext } = args;
        checkAuth(args, options);
        const organizationId = getOrganizationId(runtimeContext);
        const posts = await loadPostThread(
          this._postsService,
          organizationId,
          context.postId
        );

        if (!posts.length) {
          return {
            error: 'Post not found for this organization',
          };
        }

        const root = posts[0];
        if (root.state !== State.QUEUE && root.state !== State.DRAFT) {
          return {
            error: `Refusing to cancel post ${root.id} because its state is ${root.state}. Only QUEUE and DRAFT posts can be cancelled by this tool.`,
          };
        }

        const result = await this._postsService.deletePost(
          organizationId,
          root.group
        );

        if ('error' in result) {
          return {
            error: `Postiz failed to cancel post group ${root.group}`,
          };
        }

        return {
          output: {
            cancelled: true,
            id: result.id,
            group: root.group,
            cancelledPostIds: posts.map((post: any) => post.id),
          },
        };
      },
    });
  }
}
