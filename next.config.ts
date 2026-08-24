import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Standalone output bundles the server plus only the traced dependencies,
   * which is what the Docker runner stage copies. It has no effect on Vercel,
   * where the platform does its own packaging — so the container build and the
   * Vercel deploy stay compatible from one config.
   */
  output: 'standalone',

  /**
   * Prisma ships a native query engine that must not be bundled by the
   * compiler; keeping it external makes it resolve from node_modules at
   * runtime, which is how the engine binary is found inside the image.
   */
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
