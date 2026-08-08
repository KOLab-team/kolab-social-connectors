import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { SocialInbox } from '@gitroom/frontend/components/social-inbox/social-inbox';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Social Inbox`,
  description: 'Manage Facebook, Instagram, and Threads conversations',
};

export default function InboxPage() {
  return <SocialInbox />;
}
