#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# nginx-setup.sh — Configura Nginx como reverse proxy + SSL con Let's Encrypt
#
# Uso:  bash nginx-setup.sh tudominio.com
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN="${1:?Uso: bash nginx-setup.sh tudominio.com}"

# ── Configuración de Nginx ────────────────────────────────────────────────────
cat > "/etc/nginx/sites-available/conductores-app" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Subida de imágenes — aumentar límite (fotos de docs)
    client_max_body_size 20M;

    # Proxy a Next.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout amplio para rutas de procesamiento largo (Drive + PDF)
        proxy_read_timeout 180s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 180s;
    }
}
EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/conductores-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── SSL con Let's Encrypt ─────────────────────────────────────────────────────
echo "Obteniendo certificado SSL para ${DOMAIN}..."
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --email admin@${DOMAIN}

# Renovación automática (ya la instala Certbot, pero verificamos)
systemctl enable certbot.timer 2>/dev/null || true

echo ""
echo "✅  Nginx + SSL configurado para https://${DOMAIN}"
