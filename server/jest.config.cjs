module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  // Enable ESM support (Node's native ESM). Requires Node 18+.
  // No transforms; run JS as-is under ESM.
  transform: {},
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(js|jsx)',
    '<rootDir>/**/*.(test|spec).(js|jsx)'
  ],
  collectCoverageFrom: [
    '**/*.(js|jsx)',
    '!**/__tests__/**',
    '!**/*.d.ts'
  ]
};
