// PM2 Ecosystem config
// Usage: pm2 start ecosystem.config.js
//        pm2 startup  (to enable auto-restart on reboot)
//        pm2 save
export default {
  apps: [{
    name: 'marketplace-api',
    script: 'index.js',
    node_args: '-r dotenv/config',
    instances: process.env.NODE_ENV === 'production' ? 2 : 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '500M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 4000,
  }],
}
