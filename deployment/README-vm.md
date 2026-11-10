# VM deployment plan

The site builds to a static Vite `dist/` directory and can be served by the existing VM's Nginx host. It does not need a new application service.

The current VM inspection found Nginx active. A certificate has since been issued for `bettermiagao.org` and `www.bettermiagao.org` using DNS-01 validation. It is installed at `/etc/letsencrypt/live/bettermiagao.org/` and expires on 2027-02-08. The Nginx site has not yet been activated.

## DNS and certificate prerequisite

The certificate was issued through Certbot's manual DNS challenge after the required TXT records were published. Manual DNS validation does not renew automatically. Before expiry, repeat DNS validation or configure an authorized DNS provider plugin and renewal hook.

## Deployment sequence

1. Build the app locally with `npm ci && npm run build`.
2. Copy `dist/` to `/var/www/bettermiagao.org/` on the VM.
3. Install `bettermiagao-nginx-acme.conf` as an HTTP-only Nginx server block for both names, then test and reload Nginx.
4. Install `bettermiagao-nginx.conf` in `/etc/nginx/conf.d/`, then run `sudo nginx -t` and reload Nginx. The config can use the already-issued certificate paths above.

The final config uses SPA fallback (`try_files $uri $uri/ /index.html`) so direct navigation to `/projects`, `/people`, and `/about` works. Keep the new `server_name` separate from the existing BetterGov domains. The certificate was issued on the VM; this document does not activate the site or alter Nginx.
