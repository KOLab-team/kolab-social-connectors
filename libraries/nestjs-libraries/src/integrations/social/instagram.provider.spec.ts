import 'reflect-metadata';

jest.mock('@gitroom/helpers/utils/concurrency.service', () => ({
  concurrency: jest.fn(),
}));

import { InstagramProvider } from './instagram.provider';

describe('InstagramProvider', () => {
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

  it('requires permission to manage existing Instagram content', () => {
    expect(new InstagramProvider().scopes).toContain(
      'instagram_manage_contents'
    );
  });

  it('uses the Instagram Facebook Login configuration when configured', async () => {
    process.env.INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID = 'configuration-id';

    const { url } = await new InstagramProvider().generateAuthUrl();
    const authorizationUrl = new URL(url);

    expect(authorizationUrl.searchParams.get('config_id')).toBe(
      'configuration-id'
    );
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.has('scope')).toBe(false);
  });

  it('keeps scope-based authorization as a fallback', async () => {
    delete process.env.INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID;

    const provider = new InstagramProvider();
    const { url } = await provider.generateAuthUrl();
    const authorizationUrl = new URL(url);

    expect(authorizationUrl.searchParams.has('config_id')).toBe(false);
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      provider.scopes.join(',')
    );
  });
});
