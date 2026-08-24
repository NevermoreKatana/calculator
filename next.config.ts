import type { NextConfig } from 'next';

/**
 * `output: 'standalone'` is opt-in, enabled only by the Docker build.
 *
 * It exists for self-hosting: it emits `.next/standalone` with a bundled
 * server, which is what the container image copies. Vercel packages the app
 * itself and its post-build step is not compatible with the standalone
 * artefacts — leaving this on unconditionally made `next build` fail there with
 *   ENOENT: .next/next-server.js.nft.json
 * during "Running onBuildComplete from Vercel".
 *
 * Keying off an explicit variable rather than sniffing for Vercel keeps the
 * default output correct on every hosted platform; the container is the one
 * environment that asks for something different, so the container asks for it.
 */
const standalone = process.env.NEXT_OUTPUT_STANDALONE === '1';

const nextConfig: NextConfig = {
  ...(standalone ? { output: 'standalone' as const } : {}),

  /**
   * Prisma ships a native query engine that must not be bundled by the
   * compiler; keeping it external makes it resolve from node_modules at
   * runtime, which is how the engine binary is found inside the image.
   */
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
