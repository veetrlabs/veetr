# Website hosting

For the complete service map, email flows, deployment sequence, and troubleshooting,
see [Deployment architecture and operations](DEPLOYMENT.md).

Cloudflare Pages builds directly from GitHub. GitHub Actions performs website
checks and deploys Supabase migrations; see DATABASE_DEPLOYMENT.md.

| Host | Pages project | Source | Build | Output |
| --- | --- | --- | --- | --- |
| veetr.org, www.veetr.org | veetr-site | veetrlabs/veetr main | npm run build --workspace veetr.org | veetr.org/dist |
| veetr.com | veetr-com | veetrlabs/veetr main, root veetr.com | exit 0 | . |
| app.veetr.org | veetr-app | veetrlabs/veetr main | npm run build --workspace app | app/dist |
| game.veetr.org | veetr-game | veetrlabs/veetr-game main | exit 0 | . |

The site and app builds use NODE_VERSION=22.19.0. The main site also has
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY configured in Cloudflare. These are
public browser credentials for the Veetr Regatta project; never substitute a
service-role key. Database deployment credentials stay in GitHub Actions secrets.

GoDaddy is the registrar. Both domains use the personal Cloudflare account,
separate from Mautic. DNS mail records and m.veetr.com are independent of Pages.

Resend supplies Supabase Auth SMTP as Veetr <hello@veetr.org>. Cloudflare Email
Routing forwards hello@veetr.org and hello@veetr.com to the verified Gmail inbox.
Both addresses are configured as Gmail sending identities with separate
sending-only Resend keys restricted to their respective domains.
