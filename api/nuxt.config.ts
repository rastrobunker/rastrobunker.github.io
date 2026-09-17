export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',
  ssr: true,
  devtools: { enabled: false },
  nitro: {
    // aws-lambda preset outputs .output/server/index.mjs with a `handler` export
    // compatible with API Gateway (HTTP API), for use with the Serverless Framework.
    preset: 'aws-lambda',
    // Keep Prisma's generated client + native query engine out of the rollup bundle
    // so the query-engine binary is copied as-is into .output/server/node_modules.
    externals: {
      external: ['@prisma/client', '.prisma/client'],
    },
  },
})
