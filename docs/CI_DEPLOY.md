# GitHub Actions → VPS deploy

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)  
Runs on every push to `main` and via **Actions → Deploy to VPS → Run workflow**.

## Required repository secrets

| Secret | Example | Notes |
|--------|---------|--------|
| `SSH_HOST` | `5.8.10.197` | Public IP of this VPS (or domain that resolves here) |
| `SSH_USER` | `root` | On this server only `root` is configured for deploy; user `deploy` does not exist unless you create it |
| `SSH_PRIVATE_KEY` | *(multiline)* | Full private key: `-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END OPENSSH PRIVATE KEY-----` |
| `SSH_PORT` | `22` | Optional; default `22` |

**Do not use `SSH_PASSWORD`.** Password auth from GitHub runners is brittle (special characters, `sshpass`, policy). Use the deploy key below.

## One-time: deploy key on the VPS

On the server (already done if you follow ops runbook):

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_actions -N "" -C "github-actions-sakbol"
cat /root/.ssh/github_actions.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/github_actions /root/.ssh/authorized_keys
```

Copy the **private** key into GitHub → **Settings → Secrets and variables → Actions → New repository secret** → name `SSH_PRIVATE_KEY`:

```bash
cat /root/.ssh/github_actions
```

Paste everything, including the BEGIN/END lines. Never commit this file.

## Firewall

This VPS has **ufw inactive**; port **22** listens on `0.0.0.0`. GitHub-hosted runners use dynamic IPs — do not whitelist a single runner IP unless you use a self-hosted runner.

## Manual deploy (same as CI)

```bash
cd /opt/sakbol
git pull origin main
ln -sf .env.production .env
docker compose -f docker-compose.selfhosted.yml up -d --build --remove-orphans
```

## Troubleshooting failed runs

| Log message | Fix |
|-------------|-----|
| `Permission denied (publickey)` | Set `SSH_PRIVATE_KEY` from `/root/.ssh/github_actions`; `SSH_USER=root` |
| `Could not resolve hostname` | Fix `SSH_HOST` (use IP `5.8.10.197` if DNS is wrong) |
| `Connection refused` / timed out | Check provider firewall / security group for port 22 |
| `git pull` fails on server | Ensure `/opt/sakbol` is a git clone with access to `origin` |
| Docker build fails | `docker compose … logs web` on the VPS |

Recent failed run (password-based): [Actions run #4](https://github.com/AsanSh/sakbol_app_no2/actions/runs/26110847797) — step **Test SSH connectivity** failed before deploy (likely wrong `SSH_USER` / password / host).
