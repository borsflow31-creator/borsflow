const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // API routes: never cache, always fetch from network
      { urlPattern: /^https?.*\/api\/.*/i, handler: 'NetworkOnly' },
      // Next.js static chunks: cache forever (content-hashed)
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 200, maxAgeSeconds: 31536000 },
        },
      },
      // Next.js image optimization
      {
        urlPattern: /^\/_next\/image\?.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: { maxEntries: 100, maxAgeSeconds: 2592000 },
        },
      },
      // Google Fonts stylesheets
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 10, maxAgeSeconds: 604800 },
        },
      },
      // Google Fonts files (immutable)
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 31536000 },
        },
      },
      // Static assets (icons, images, fonts)
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2|woff)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 64, maxAgeSeconds: 2592000 },
        },
      },
    ],
  },
  fallbacks: { document: '/offline' },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
