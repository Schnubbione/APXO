module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
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
