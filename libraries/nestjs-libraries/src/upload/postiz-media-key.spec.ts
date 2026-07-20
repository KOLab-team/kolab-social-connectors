import {
  postizMediaObjectKey,
  postizMediaPublicUrl,
} from './postiz-media-key';

describe('Postiz public-media object paths', () => {
  it('stores every object below the postiz-media folder', () => {
    expect(postizMediaObjectKey('video.mp4')).toBe('postiz-media/video.mp4');
    expect(postizMediaObjectKey('/image.png')).toBe('postiz-media/image.png');
  });

  it('joins the public base URL without duplicate slashes', () => {
    expect(
      postizMediaPublicUrl(
        'https://media.example.com/',
        postizMediaObjectKey('video.mp4')
      )
    ).toBe('https://media.example.com/postiz-media/video.mp4');
  });
});
