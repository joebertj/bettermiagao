# VM deployment plan

The site builds to a static Vite `dist/` directory and can be served by the existing VM's Nginx host. It does not need a new application service.

The current VM inspection found Nginx active. A certificate has since been issued for `bettermiagao.org` and `www.bettermiagao.org` using DNS-01 validation. It is installed at `/etc/letsencrypt/live/bettermiagao.org/` and expires on 2027-02-08. The Nginx site has not yet been activated.

## DNS and certificate prerequisite

The certificate was issued through Certbot's manual DNS challenge after the required TXT records were published. Manual DNS validation does not renew automatically. Before expiry, repeat DNS validation or configure an authorized DNS provider plugin and renewal hook.

## Deployment sequence

1. One-time VM setup: install Node.js/npm and install `bettermiagao-nginx.conf` in `/etc/nginx/conf.d/`. Run `sudo nginx -t` and reload Nginx after installing the site config. The deploy script clones the Git repository into the SSH account's home directory if needed.
2. Commit and push the intended site version to `origin/main`.
3. Set `BETTERMIAGAO_SSH_TARGET` in the local, Git-ignored `.env` file, then run `bash ./deployment/deploy-bettermiagao.sh`. No command-line target override is needed.

The script checks that the local checkout is clean and matches `origin/main`, asks before deployment, then fetches that exact commit on the VM, builds it there, and syncs `dist/` to `/var/www/bettermiagao.org/`. It requires SSH access, Node.js/npm, rsync, and passwordless `sudo` for the web-root copy. It refuses to reset a dirty server checkout. Static-file deployments do not restart an app service or reload Nginx. Keep the `.env` file local; `.gitignore` excludes it.

The final config uses SPA fallback (`try_files $uri $uri/ /index.html`) so direct navigation to `/projects`, `/people`, and `/about` works. Keep the new `server_name` separate from the existing BetterGov domains. The certificate was issued on the VM; this document does not activate the site or alter Nginx.
