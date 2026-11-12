import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/src/components/Logo";

const compose = `services:
  asf:
    image: justarchinet/archisteamfarm:latest
    restart: unless-stopped
    stdin_open: true
    tty: true
    volumes:
      - ./asf/config:/app/config
      - ./asf/plugins:/app/plugins
  epic:
    image: ghcr.io/claabs/epicgames-freegames-node:latest
    restart: unless-stopped
    init: true
    shm_size: 1gb
    mem_limit: 2g
    ports:
      - "127.0.0.1:3300:3000"
    volumes:
      - ./epic/config:/usr/app/config`;

export default async function SelfHostPage() {
  await connection();
  return <main className="public-prose"><Logo /><h1>Your machine.<br />Your accounts.</h1><p>Snag finds offers and links to stores; it does not automatically claim games for public users. These optional third-party tools run separately on your own always-on machine: a home PC, compatible Raspberry Pi or cheap VPS. Check current image CPU support; older ARM devices may not work. Epic’s browser needs about 2 GB RAM plus operating-system headroom.</p>
    <h2 id="safety"><a href="#safety">Before you start</a></h2><p>These are documentation examples, not a live-tested deployment. Review upstream documentation, release compatibility and account terms. Automation may fail or require human action. You accept the risk of a persistent Steam/Epic session on your machine. Use Steam Guard and Epic 2FA. Never send passwords, cookies or tokens to Snag, commit them to Git, or paste them into public issues.</p>
    <h2 id="compose"><a href="#compose">Private Docker Compose</a></h2><p>Install Docker Engine with Compose. In a private directory outside any source checkout, create the directories below and save the YAML as compose.yaml. The bind mounts persist configuration and sessions across container replacement. Restrict directory access; grant only the container’s required UID access, never chmod 777.</p><pre><code>{`umask 077
mkdir -p asf/config asf/plugins epic/config`}</code></pre><pre><code>{compose}</code></pre><p>No ASF ports are published. IPC must stay disabled: create asf/config/ASF.json with the following content before starting. Do not enable IPC automatically, publish port 1242 or use host networking. If you deliberately add IPC later, follow upstream authentication guidance, use a unique 32+ character password, bind access to loopback and verify it cannot be reached remotely.</p><pre><code>{`{
  "IPC": false
}`}</code></pre><p>Epic’s login helper is bound to loopback only, not your public IP. Shared memory is private to the container; no host IPC or privileged mode is used. Port 3300 is for this tool, separate from Snag. On a remote machine, use an authenticated SSH tunnel rather than public forwarding; configure the upstream web portal base URL for your local tunnel. Do not enable localtunnel or a public reverse proxy by default.</p>
    <h2 id="steam"><a href="#steam">Steam: ASF + FreePackages</a></h2><ol><li>Read <a href="https://github.com/JustArchiNET/ArchiSteamFarm/wiki/Docker">ASF’s Docker guide</a> and <a href="https://github.com/Citrinate/FreePackages">Citrinate/FreePackages</a>. Download a trusted release compatible with your ASF version. Unpack it into asf/plugins/FreePackages; preserve its license notices. Upstream tests the plugin against ASF-generic; verify your chosen image works.</li><li>Create your own bot configuration in asf/config using ASF’s upstream configuration guide. Enable the bot and merge the options below. No username or password is supplied here. Enter your own credentials and Steam Guard interactively on your machine with docker compose attach asf when prompted. Detach using Ctrl-P then Ctrl-Q.</li><li>Confirm the plugin loads and the bot logs in. Review filters: these select games and exclude free weekends; they do not guarantee all limited-time offers are found.</li></ol><pre><code>{`{
  "Enabled": true,
  "EnableFreePackages": true,
  "PauseFreePackagesWhilePlaying": true,
  "FreePackagesFilters": [
    { "Types": ["Game"], "NoCostOnly": true, "IgnoreFreeWeekends": true }
  ]
}`}</code></pre>
    <h2 id="epic"><a href="#epic">Epic: login and checkout help</a></h2><p>Follow <a href="https://github.com/claabs/epicgames-freegames-node">claabs/epicgames-freegames-node</a> to create epic/config/config.json locally with your account and a notifier you control. Set webPortalConfig.baseUrl to your loopback helper address and leave public tunneling off. Complete device login and any checkout or CAPTCHA yourself. Current upstream describes prepopulated checkout links, not guaranteed unattended claiming. Never assume CAPTCHA bypass or automatic checkout.</p>
    <h2 id="run"><a href="#run">Run, update and preserve data</a></h2><pre><code>{`docker compose config --quiet
docker compose up -d
docker compose logs --tail=50
docker compose down`}</code></pre><p>Inspect logs locally; they may contain sensitive login links. docker compose down stops containers without deleting the bind-mounted folders. Back up asf/config, asf/plugins and epic/config securely while services are stopped; these include sensitive sessions. Encrypt backups, restrict access and define a retention period. Never delete the folders unless you intend to erase configuration and sessions.</p><p>The examples use mutable latest tags for readability. Before unattended use, select reviewed releases and pin image digests, then verify plugin compatibility. Back up before docker compose pull and docker compose up -d. Check upstream release notes after updates. None of these services is wired to Snag; no reporting or public IPC is installed.</p><p><Link href="/">Back to Snag</Link> · <a href="/privacy">Privacy</a></p>
  </main>;
}
