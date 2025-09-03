module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: [
    '<rootDir>/__tests__/**/*.(ts|js)',
    '<rootDir>/**/*.(test|spec).(ts|js)'
  ],
  collectCoverageFrom: [
    '**/*.(ts|js)',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
