import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 999999,
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: ['tsrpc', 'tsrpc-base-client', 'tsrpc-proto', 'ws'],
      },
    },
  },
})
