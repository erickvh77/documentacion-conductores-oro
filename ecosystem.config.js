/**
 * PM2 ecosystem — define cómo se ejecuta la app en producción.
 * El deploy usa: pm2 restart conductores-app --update-env
 */
module.exports = {
  apps: [
    {
      name: "conductores-app",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/conductores-app",
      instances: 1,          // 1 instancia (requerido por el manejo de temp files)
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logs
      out_file: "/var/log/pm2/conductores-app.log",
      error_file: "/var/log/pm2/conductores-app-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
