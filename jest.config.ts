import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/{apps,libraries}/**/*.(spec|test).ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/cron/(.*)$': '<rootDir>/apps/cron/src/$1',
    '^@gitroom/frontend/(.*)$': '<rootDir>/apps/frontend/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/react/(.*)$':
      '<rootDir>/libraries/react-shared-libraries/src/$1',
    '^@gitroom/plugins/(.*)$': '<rootDir>/libraries/plugins/src/$1',
    '^@gitroom/workers/(.*)$': '<rootDir>/apps/workers/src/$1',
    '^@gitroom/extension/(.*)$': '<rootDir>/apps/extension/src/$1',
  },
  coverageDirectory: '<rootDir>/coverage',
};

export default config;
