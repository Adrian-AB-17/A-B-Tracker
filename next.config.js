/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['app.abconsultingg.com', 'localhost:3000'] }
  }
}
module.exports = nextConfig
