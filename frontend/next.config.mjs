const nextConfig = {
  poweredByHeader: false,
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
};
export default nextConfig;
