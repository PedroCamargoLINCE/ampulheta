import { defineConfig } from 'vitest/config';

// base relativa: o mesmo build funciona em https://<usuario>.github.io/ampulheta/ e localmente.
export default defineConfig({
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
