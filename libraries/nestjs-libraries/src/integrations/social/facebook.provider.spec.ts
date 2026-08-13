jest.mock('@gitroom/helpers/utils/concurrency.service', () => ({
  concurrency: jest.fn(),
}));

import { FacebookProvider } from './facebook.provider';

describe('FacebookProvider.generateAuthUrl', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      FACEBOOK_APP_ID: 'facebook-app-id',
      FRONTEND_URL: 'https://socials.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('uses the Facebook Login for Business configuration when configured', async () => {
    process.env.FACEBOOK_LOGIN_CONFIG_ID = 'configuration-id';

    const { url } = await new FacebookProvider().generateAuthUrl();
    const authorizationUrl = new URL(url);

    expect(authorizationUrl.searchParams.get('config_id')).toBe(
      'configuration-id'
    );
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.has('scope')).toBe(false);
  });

  it('keeps scope-based authorization as a fallback', async () => {
    delete process.env.FACEBOOK_LOGIN_CONFIG_ID;

    const provider = new FacebookProvider();
    const { url } = await provider.generateAuthUrl();
    const authorizationUrl = new URL(url);

    expect(authorizationUrl.searchParams.has('config_id')).toBe(false);
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      provider.scopes.join(',')
    );
  });
});
