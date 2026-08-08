# Portal VPS deployment

This stack deploys the KOLab social connector application independently from
the original Postiz service. It uses dedicated Postgres, Redis, upload, and
configuration volumes and joins the portal's `kolab_default` network only for
reverse proxy traffic from Caddy.

## Deploy

1. Copy this directory to `/opt/kolab-socials` on the portal VPS.
2. Run `chmod +x bootstrap-env.sh && ./bootstrap-env.sh` once.
3. Add `Caddyfile.snippet` to `/opt/kolab/Caddyfile` and validate the Caddy
   configuration.
4. Run `docker compose pull` and `docker compose up -d`.
5. Add a Cloudflare A record for `socials.kolab-inc.com` pointing to
   `95.216.185.50`.

The generated `.env` is mode 600 and is never committed. Add the reviewed Meta
app IDs and secrets to that file later, then recreate only the `socials`
container.
