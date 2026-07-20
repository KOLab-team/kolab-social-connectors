export const POSTIZ_MEDIA_PREFIX = 'postiz-media';

export function postizMediaObjectKey(fileName: string): string {
  return `${POSTIZ_MEDIA_PREFIX}/${fileName.replace(/^\/+/, '')}`;
}

export function postizMediaPublicUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${key}`;
}
