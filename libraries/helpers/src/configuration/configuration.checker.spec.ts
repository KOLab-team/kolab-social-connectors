import { ConfigurationChecker } from './configuration.checker';

describe('ConfigurationChecker public R2 storage', () => {
  it('requires the public R2 configuration for Cloudflare storage', () => {
    const checker = new ConfigurationChecker();
    checker.cfg = { STORAGE_PROVIDER: 'cloudflare' };

    checker.checkPublicR2Storage();

    expect(checker.getIssues()).toEqual([
      'PUBLIC_R2_ACCOUNT_ID not set. ',
      'PUBLIC_R2_ACCESS_KEY_ID not set. ',
      'PUBLIC_R2_SECRET_ACCESS_KEY not set. ',
      'PUBLIC_BUCKET not set. ',
      'PUBLIC_BASE_URL not set. ',
    ]);
  });

  it('accepts a complete public R2 configuration', () => {
    const checker = new ConfigurationChecker();
    checker.cfg = {
      STORAGE_PROVIDER: 'cloudflare',
      PUBLIC_R2_ACCOUNT_ID: 'account',
      PUBLIC_R2_ACCESS_KEY_ID: 'access-key',
      PUBLIC_R2_SECRET_ACCESS_KEY: 'secret-key',
      PUBLIC_BUCKET: 'public-media',
      PUBLIC_BASE_URL: 'https://public-media.example.com',
    };

    checker.checkPublicR2Storage();

    expect(checker.getIssues()).toEqual([]);
  });
});
