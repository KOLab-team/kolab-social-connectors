# Social inbox

The social inbox keeps Facebook Page Messenger, Instagram professional-account DMs, and public Threads replies separate from the marketplace buyer/seller messaging system.

## Supported channels

| Channel                        | Receive                                            | Reply                  |
| ------------------------------ | -------------------------------------------------- | ---------------------- |
| Facebook Page                  | Meta webhooks                                      | Messenger Send API     |
| Instagram professional account | Meta webhooks                                      | Instagram Send API     |
| Threads                        | Poll public replies to posts published by this app | Publish a public reply |

Threads direct messages are not exposed by the public Threads API, so they are intentionally not represented in this inbox.

## Environment

Set the existing Facebook, Instagram, and Threads app credentials, plus:

```env
META_WEBHOOK_VERIFY_TOKEN="a-long-random-value"
META_GRAPH_VERSION="v25.0"
```

Apply the schema and restart the backend, workers, cron process, and frontend:

```bash
pnpm run prisma-db-push
pnpm run dev
```

## Meta configuration

Configure the webhook callback URLs against the public backend URL, not the frontend URL:

- Facebook: `https://api.example.com/social-inbox/webhooks/facebook`
- Instagram: `https://api.example.com/social-inbox/webhooks/instagram`

Use `META_WEBHOOK_VERIFY_TOKEN` as the verification token. Subscribe the Facebook Page webhook product to `messages`, `message_echoes`, `messaging_postbacks`, `messaging_optins`, `message_deliveries`, and `message_reads`. Subscribe Instagram to `messages` and `messaging_seen`.

The OAuth providers now request the messaging permissions and subscribe each selected Page/account to the app. Existing Facebook, Instagram, and Threads integrations must be reconnected to grant the new scopes:

- Facebook: `pages_manage_metadata`, `pages_messaging`
- Instagram via Facebook Login: `pages_manage_metadata`, `instagram_manage_messages`
- Instagram Login: `instagram_business_manage_messages`
- Threads: `threads_read_replies`, `threads_manage_replies`

For accounts that are not app roles, Meta must approve the applicable permissions for Advanced Access. Facebook and Instagram users must initiate a conversation before the app can reply, and replies remain subject to Meta's messaging-window policies.

## Runtime behavior

Incoming webhooks are verified against `X-Hub-Signature-256`, queued, normalized, and deduplicated by their provider message IDs. Outbound messages are saved as pending before being queued and are retried with exponential backoff. Echo webhooks are matched to pending messages to prevent duplicate rows.

The cron service polls Facebook and Instagram as a missed-webhook repair path and polls Threads replies every five minutes. The first backfill imports history without marking every historical message unread. The **Sync** button queues an organization-scoped sync immediately. Only Threads replies to published posts with a stored `releaseId` are imported.
