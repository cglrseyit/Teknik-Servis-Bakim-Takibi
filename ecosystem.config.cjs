// PM2 ecosystem — backend + frontend dev sunucularını yönetir.
// Komutlar:
//   pm2 start ecosystem.config.cjs     → ikisini de başlat
//   pm2 list                            → durum
//   pm2 logs                            → canlı log
//   pm2 logs teknik-backend             → sadece backend
//   pm2 restart all                     → ikisini de yeniden başlat
//   pm2 stop all                        → ikisini de durdur
//   pm2 save                            → mevcut durumu kaydet (boot sonrası resurrect için)
module.exports = {
  apps: [
    {
      name: 'teknik-backend',
      cwd: 'c:/Users/burka/Desktop/Teknik Bakım Takip Uygulaması/backend',
      script: 'node_modules/nodemon/bin/nodemon.js',
      args: 'src/app.js',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'teknik-frontend',
      cwd: 'c:/Users/burka/Desktop/Teknik Bakım Takip Uygulaması/frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '',
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
