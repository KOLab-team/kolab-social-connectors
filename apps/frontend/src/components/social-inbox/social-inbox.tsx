'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';
type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED';

type Contact = {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  externalId: string;
};

type Message = {
  id: string;
  text?: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  sentAt: string;
  error?: string | null;
  attachments?: { id: string; type: string; url?: string | null }[];
};

type Conversation = {
  id: string;
  platform: Platform;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt: string;
  contact: Contact;
  integration: {
    id: string;
    name: string;
    picture?: string | null;
    providerIdentifier: string;
    refreshNeeded: boolean;
  };
  messages: Message[];
};

type ConversationDetail = Omit<Conversation, 'messages'> & {
  messages: Message[];
  notes: { id: string; content: string; createdAt: string }[];
};

const platformDetails: Record<
  Platform,
  { label: string; icon: string; description: string }
> = {
  FACEBOOK: {
    label: 'Facebook',
    icon: '/icons/platforms/facebook.png',
    description: 'Page Messenger',
  },
  INSTAGRAM: {
    label: 'Instagram',
    icon: '/icons/platforms/instagram.png',
    description: 'Professional account DMs',
  },
  THREADS: {
    label: 'Threads',
    icon: '/icons/platforms/threads.png',
    description: 'Public post replies',
  },
};

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
};

export function SocialInbox() {
  const request = useFetch();
  const [platform, setPlatform] = useState<Platform | 'ALL'>('ALL');
  const [status, setStatus] = useState<ConversationStatus>('OPEN');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const load = async (url: string) => {
    const response = await request(url);
    if (!response.ok) throw new Error('Could not load the social inbox');
    return response.json();
  };
  const listUrl = useMemo(() => {
    const query = new URLSearchParams({ status });
    if (platform !== 'ALL') query.set('platform', platform);
    if (search.trim()) query.set('search', search.trim());
    return `/social-inbox/conversations?${query.toString()}`;
  }, [platform, search, status]);

  const list = useSWR<{ conversations: Conversation[] }>(listUrl, load, {
    refreshInterval: 8000,
    keepPreviousData: true,
  });
  const detail = useSWR<ConversationDetail>(
    selectedId ? `/social-inbox/conversations/${selectedId}` : null,
    load,
    { refreshInterval: 4000 }
  );
  const capabilities = useSWR<
    { id: string; providerIdentifier: string; refreshNeeded: boolean }[]
  >('/social-inbox/capabilities', load);

  useEffect(() => {
    const conversations = list.data?.conversations || [];
    if (!conversations.length) {
      setSelectedId(undefined);
      return;
    }
    if (!conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [list.data, selectedId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || submitting) return;
    const value = composerMode === 'reply' ? message.trim() : note.trim();
    if (!value) return;
    setSubmitting(true);
    setError(undefined);
    const endpoint =
      composerMode === 'reply'
        ? `/social-inbox/conversations/${selectedId}/messages`
        : `/social-inbox/conversations/${selectedId}/notes`;
    const response = await request(endpoint, {
      method: 'POST',
      body: JSON.stringify(
        composerMode === 'reply'
          ? { text: value, clientRequestId: crypto.randomUUID() }
          : { content: value }
      ),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.message || 'Could not send');
    } else {
      if (composerMode === 'reply') setMessage('');
      else setNote('');
      await Promise.all([detail.mutate(), list.mutate()]);
    }
    setSubmitting(false);
  };

  const updateStatus = async (nextStatus: ConversationStatus) => {
    if (!selectedId) return;
    await request(`/social-inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await Promise.all([detail.mutate(), list.mutate()]);
  };

  const retryMessage = async (messageId: string) => {
    const response = await request(
      `/social-inbox/messages/${messageId}/retry`,
      {
        method: 'POST',
        body: '{}',
      }
    );
    if (!response.ok) {
      setError('Could not retry this message');
      return;
    }
    setError(undefined);
    await detail.mutate();
  };

  const sync = async () => {
    await request('/social-inbox/sync', { method: 'POST', body: '{}' });
    window.setTimeout(() => list.mutate(), 1500);
  };

  const noConnections = capabilities.data?.length === 0;

  return (
    <div className="flex flex-1 min-w-0 bg-newBgColorInner">
      <aside className="w-[360px] min-w-[300px] border-e border-newTableBorder flex flex-col">
        <div className="p-[18px] border-b border-newTableBorder flex flex-col gap-[12px]">
          <div className="flex gap-[8px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              className="h-[40px] min-w-0 flex-1 rounded-[8px] border border-newTableBorder bg-newBgColor px-[12px] text-[13px]"
            />
            <button
              type="button"
              onClick={sync}
              className="h-[40px] px-[12px] rounded-[8px] border border-newTableBorder hover:bg-boxFocused text-[13px]"
            >
              Sync
            </button>
          </div>
          <div className="flex gap-[6px] overflow-x-auto">
            {(['ALL', 'FACEBOOK', 'INSTAGRAM', 'THREADS'] as const).map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setPlatform(item)}
                  className={clsx(
                    'rounded-full px-[10px] py-[6px] text-[11px] whitespace-nowrap',
                    platform === item
                      ? 'bg-btnPrimary text-white'
                      : 'bg-newTableHeader text-textItemBlur'
                  )}
                >
                  {item === 'ALL' ? 'All' : platformDetails[item].label}
                </button>
              )
            )}
          </div>
          <div className="flex gap-[14px] text-[12px] text-textItemBlur">
            {(['OPEN', 'PENDING', 'RESOLVED'] as const).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setStatus(item)}
                className={clsx(
                  'pb-[5px] capitalize',
                  status === item &&
                    'text-newTextColor border-b-2 border-btnPrimary'
                )}
              >
                {item.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {list.isLoading ? (
            <div className="p-[24px] text-sm text-textItemBlur">Loading…</div>
          ) : !list.data?.conversations.length ? (
            <div className="p-[24px] text-sm text-textItemBlur leading-6">
              {noConnections
                ? 'Connect a Facebook Page, Instagram professional account, or Threads profile to start.'
                : 'No conversations match these filters. New Facebook and Instagram conversations appear after a customer messages you; Threads replies sync every five minutes.'}
            </div>
          ) : (
            list.data.conversations.map((conversation) => {
              const lastMessage = conversation.messages[0];
              return (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={clsx(
                    'w-full text-start p-[15px] border-b border-newTableBorder hover:bg-boxFocused flex gap-[11px]',
                    selectedId === conversation.id && 'bg-boxFocused'
                  )}
                >
                  <ContactAvatar conversation={conversation} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[8px]">
                      <div className="truncate text-[14px] font-[600] flex-1">
                        {conversation.contact.name ||
                          conversation.contact.username ||
                          'Social user'}
                      </div>
                      <span className="text-[10px] text-textItemBlur whitespace-nowrap">
                        {relativeTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-[7px] mt-[5px]">
                      <span className="truncate text-[12px] text-textItemBlur flex-1">
                        {lastMessage?.direction === 'OUTBOUND' ? 'You: ' : ''}
                        {lastMessage?.text || 'Attachment'}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="min-w-[20px] h-[20px] px-[5px] rounded-full bg-btnPrimary text-white text-[10px] flex items-center justify-center">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {!selectedId || !detail.data ? (
          <div className="flex-1 flex items-center justify-center text-textItemBlur text-sm">
            {detail.isLoading
              ? 'Loading conversation…'
              : 'Select a conversation'}
          </div>
        ) : (
          <>
            <header className="h-[72px] border-b border-newTableBorder px-[20px] flex items-center gap-[12px]">
              <ContactAvatar conversation={detail.data} large />
              <div className="min-w-0 flex-1">
                <div className="font-[600] truncate">
                  {detail.data.contact.name || detail.data.contact.username}
                </div>
                <div className="text-[11px] text-textItemBlur flex items-center gap-[5px]">
                  <Image
                    src={platformDetails[detail.data.platform].icon}
                    alt=""
                    width={14}
                    height={14}
                  />
                  {platformDetails[detail.data.platform].description} via{' '}
                  {detail.data.integration.name}
                </div>
              </div>
              <select
                value={detail.data.status}
                onChange={(event) =>
                  updateStatus(event.target.value as ConversationStatus)
                }
                className="bg-newBgColor border border-newTableBorder rounded-[8px] px-[10px] h-[36px] text-[12px]"
              >
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </header>

            <div className="flex-1 overflow-y-auto p-[22px] flex flex-col gap-[12px] bg-newBgColor">
              {detail.data.messages.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    'max-w-[72%] flex flex-col',
                    item.direction === 'OUTBOUND'
                      ? 'self-end items-end'
                      : 'self-start'
                  )}
                >
                  <div
                    className={clsx(
                      'px-[14px] py-[10px] rounded-[14px] text-[13px] whitespace-pre-wrap break-words',
                      item.direction === 'OUTBOUND'
                        ? 'bg-btnPrimary text-white rounded-ee-[4px]'
                        : 'bg-newBgColorInner border border-newTableBorder rounded-es-[4px]'
                    )}
                  >
                    {item.text || 'Attachment'}
                    {item.attachments?.map((attachment) =>
                      attachment.url ? (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block underline mt-[6px]"
                        >
                          Open {attachment.type}
                        </a>
                      ) : null
                    )}
                  </div>
                  <div
                    className={clsx(
                      'text-[10px] text-textItemBlur mt-[4px]',
                      item.status === 'FAILED' && 'text-red-400'
                    )}
                  >
                    {new Date(item.sentAt).toLocaleString()} ·{' '}
                    {item.status.toLowerCase()}
                    {item.error ? ` · ${item.error}` : ''}
                    {item.status === 'FAILED' && (
                      <button
                        type="button"
                        onClick={() => retryMessage(item.id)}
                        className="ms-[6px] underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {detail.data.notes.map((item) => (
                <div
                  key={item.id}
                  className="self-center max-w-[80%] bg-amber-300/10 border border-amber-300/30 text-[12px] rounded-[8px] px-[12px] py-[8px]"
                >
                  Internal note: {item.content}
                </div>
              ))}
            </div>

            <form
              onSubmit={submit}
              className="border-t border-newTableBorder p-[16px]"
            >
              <div className="flex gap-[4px] mb-[9px]">
                {(['reply', 'note'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setComposerMode(mode)}
                    className={clsx(
                      'px-[10px] py-[5px] rounded-[6px] text-[11px] capitalize',
                      composerMode === mode
                        ? 'bg-boxFocused text-newTextColor'
                        : 'text-textItemBlur'
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex gap-[10px]">
                <textarea
                  value={composerMode === 'reply' ? message : note}
                  onChange={(event) =>
                    composerMode === 'reply'
                      ? setMessage(event.target.value)
                      : setNote(event.target.value)
                  }
                  placeholder={
                    composerMode === 'reply'
                      ? detail.data.platform === 'THREADS'
                        ? 'Reply publicly on Threads…'
                        : 'Reply to this conversation…'
                      : 'Leave an internal note…'
                  }
                  rows={2}
                  maxLength={composerMode === 'reply' ? 2000 : 4000}
                  className="flex-1 resize-none rounded-[8px] border border-newTableBorder bg-newBgColor p-[11px] text-[13px]"
                />
                <button
                  disabled={submitting}
                  className="self-end h-[40px] rounded-[8px] bg-btnPrimary px-[18px] text-white text-[13px] disabled:opacity-50"
                >
                  {submitting
                    ? 'Sending…'
                    : composerMode === 'reply'
                    ? 'Send'
                    : 'Add note'}
                </button>
              </div>
              {error && (
                <div className="mt-[7px] text-[11px] text-red-400">{error}</div>
              )}
              {composerMode === 'reply' && (
                <div className="mt-[7px] text-[10px] text-textItemBlur">
                  Meta may reject replies outside its allowed messaging window.
                  Threads replies are public.
                </div>
              )}
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function ContactAvatar({
  conversation,
  large = false,
}: {
  conversation: Pick<Conversation, 'contact' | 'platform'>;
  large?: boolean;
}) {
  const size = large ? 42 : 38;
  const name =
    conversation.contact.name || conversation.contact.username || 'Social user';
  return (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0 rounded-full bg-newTableHeader flex items-center justify-center overflow-hidden font-[600] text-[13px]"
    >
      {conversation.contact.avatarUrl ? (
        <Image
          src={conversation.contact.avatarUrl}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
      <Image
        src={platformDetails[conversation.platform].icon}
        alt={platformDetails[conversation.platform].label}
        width={15}
        height={15}
        className="absolute end-0 bottom-0 rounded-full"
      />
    </div>
  );
}
