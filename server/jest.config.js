export default {
  maxWorkers: 1,
  projects: [
    {
      displayName: 'contract',
      testEnvironment: 'node',
      setupFiles: ['./tests/contract/setup.js'],
      testMatch: ['**/tests/contract/**/*.test.js'],
    },
    {
      displayName: 'unit',
      testEnvironment: 'node',
      setupFiles: ['./tests/unit/setup.js'],
      testMatch: ['**/tests/unit/**/*.test.js'],
    },
    {
      displayName: 'unit-auth-coverage',
      testEnvironment: 'node',
      setupFiles: ['./tests/unit/setup.js'],
      testMatch: ['**/tests/unit/auth.test.js'],
      collectCoverageFrom: [
        'src/middleware/auth.js',
        'src/services/auth-service.js',
      ],
      coverageThreshold: {
        'src/middleware/auth.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/services/auth-service.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  ],
};
