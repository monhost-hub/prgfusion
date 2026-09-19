/**
 * PM2 ecosystem configuration for AllCombiner production.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart allcombiner
 *   pm2 logs allcombiner
 *   pm2 stop allcombiner
 *   pm2 delete allcombiner
 *
 * PM2 auto-restarts the process if it crashes, keeps it alive across reboots
 * (with `pm2 startup` + `pm2 save`), and provides log rotation.
 */
module.exports = {
  apps: [{
    name: "allcombiner",
    script: ".next/standalone/server.js",
    cwd: __dirname,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: "512M",
    env: {
      NODE_ENV: "production",
      PORT: process.env.PORT || 3000,
      HOST: "0.0.0.0",
    },
    error_file: "./logs/error.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",
    time: true,
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }],
};
