import { env } from '../../config/env.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import { AppError } from '../../utils/errors.js';

const graph = 'https://graph.instagram.com';
const version = env.META_GRAPH_VERSION;

async function graphPost(path, token, fields) {
  const body = new URLSearchParams({ access_token: token, ...fields });
  const response = await fetch(`${graph}/${version}/${path}`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.error)
    throw new AppError(
      data.error?.message || 'Instagram publishing failed.',
      502,
      'INSTAGRAM_API_ERROR',
    );
  return data;
}

async function getAccessToken(account) {
  let token = decrypt(account.encryptedAccessToken);
  const refreshAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < refreshAt) {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', token);
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok || data.error || !data.access_token)
      throw new AppError(
        data.error?.message || 'Reconnect Instagram to refresh its access token.',
        401,
        'INSTAGRAM_TOKEN_EXPIRED',
      );
    token = data.access_token;
    account.encryptedAccessToken = encrypt(token);
    account.tokenExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : account.tokenExpiresAt;
    await account.save();
  }
  return token;
}

export async function publishInstagramPost({ post, account }) {
  if (!post.imageUrl || !/^https:\/\//i.test(post.imageUrl)) {
    throw new AppError(
      'Instagram requires an image hosted at a public HTTPS URL.',
      422,
      'PUBLIC_IMAGE_REQUIRED',
    );
  }
  if ([post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n').length > 2200)
    throw new AppError('Caption and hashtags exceed 2,200 characters.', 422, 'CAPTION_TOO_LONG');
  const accessToken = await getAccessToken(account);
  const caption = [post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n');
  const media = post.remoteContainerId
    ? { id: post.remoteContainerId }
    : await graphPost(`${account.accountId}/media`, accessToken, {
        image_url: post.imageUrl,
        caption,
      });
  if (!post.remoteContainerId) {
    post.remoteContainerId = media.id;
    await post.save();
  }
  let status = 'IN_PROGRESS';
  for (let attempt = 0; attempt < 8 && status === 'IN_PROGRESS'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const url = new URL(`${graph}/${version}/${media.id}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', accessToken);
    const poll = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const state = await poll.json();
    if (!poll.ok || state.error)
      throw new AppError(
        state.error?.message || 'Instagram could not prepare the image.',
        502,
        'INSTAGRAM_MEDIA_ERROR',
      );
    status = state.status_code;
    if (status === 'ERROR' || status === 'EXPIRED')
      throw new AppError(
        'Instagram rejected the media container.',
        502,
        'INSTAGRAM_MEDIA_REJECTED',
      );
  }
  if (status !== 'FINISHED')
    throw new AppError(
      'Instagram is still processing the image. Retry publishing shortly.',
      502,
      'INSTAGRAM_MEDIA_PENDING',
    );
  const published = await graphPost(`${account.accountId}/media_publish`, accessToken, {
    creation_id: media.id,
  });
  return published.id;
}
