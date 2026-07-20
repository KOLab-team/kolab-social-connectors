import { CloudflareStorage } from './cloudflare.storage';
import { IUploadProvider } from './upload.interface';
import { LocalStorage } from './local.storage';

export class UploadFactory {
  static createStorage(): IUploadProvider {
    const storageProvider = process.env.STORAGE_PROVIDER || 'local';

    switch (storageProvider) {
      case 'local':
        return new LocalStorage(process.env.UPLOAD_DIRECTORY!);
      case 'cloudflare':
        return new CloudflareStorage(
          process.env.PUBLIC_R2_ACCOUNT_ID!,
          process.env.PUBLIC_R2_ACCESS_KEY_ID!,
          process.env.PUBLIC_R2_SECRET_ACCESS_KEY!,
          'auto',
          process.env.PUBLIC_BUCKET!,
          process.env.PUBLIC_BASE_URL!
        );
      default:
        throw new Error(`Invalid storage type ${storageProvider}`);
    }
  }
}
