import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { Brand } from '../models/Brand.js';
import { SocialAccount } from '../models/SocialAccount.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { encrypt } from '../utils/crypto.js';
import { n8nConfigured, sendN8nEvent } from '../services/n8n.js';

const router = Router();
const instagramAuthorize = 'https://www.instagram.com/oauth/authorize';

router.get('/n8n/status', requireAuth, (_req, res) => {
  res.json({ configured: n8nConfigured(), provider: 'n8n', events: ['post.created', 'post.scheduled', 'post.published', 'post.failed'] });
});

router.post('/n8n/test', requireAuth, asyncHandler(async (req, res) => {
  if (!n8nConfigured()) throw new AppError('n8n is not configured. Add N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET to the backend environment.', 503, 'N8N_NOT_CONFIGURED');
  await sendN8nEvent('integration.test', { brandId: String(req.user.brandId), message: 'Ostras n8n connection test' });
  res.json({ success: true, message: 'Test event delivered to n8n.' });
}));

router.get('/instagram/connect', requireAuth, asyncHandler(async (req, res) => {
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new AppError('Instagram connection needs Meta app credentials in the API environment.', 503, 'META_NOT_CONFIGURED');
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie('ostras_oauth_state', `${state}.${req.user._id}`, {
    httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/integrations/instagram/callback',
  });
  const url = new URL(instagramAuthorize);
  url.searchParams.set('client_id', env.META_APP_ID);
  url.searchParams.set('redirect_uri', env.META_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
}));

router.get('/instagram/callback', asyncHandler(async (req, res) => {
  const savedState = req.cookies.ostras_oauth_state || '';
  res.clearCookie('ostras_oauth_state', { path: '/api/integrations/instagram/callback', sameSite: 'lax', secure: env.NODE_ENV === 'production' });
  const [expectedState, userId] = savedState.split('.');
  if (!req.query.code || !expectedState || !req.query.state || expectedState !== req.query.state) {
    return res.redirect(`${env.WEB_ORIGIN}/settings?instagram=failed`);
  }
  const owner = await User.findById(userId);
  if (!owner?.brandId) return res.redirect(`${env.WEB_ORIGIN}/settings?instagram=failed`);

  const tokenForm = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: env.META_REDIRECT_URI,
    code: String(req.query.code),
  });
  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: tokenForm });
  const shortToken = await shortResponse.json();
  if (!shortResponse.ok || shortToken.error_type) throw new AppError(shortToken.error_message || 'Instagram authorization failed.', 502, 'INSTAGRAM_OAUTH_FAILED');

  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', env.META_APP_SECRET);
  longUrl.searchParams.set('access_token', shortToken.access_token);
  const longResponse = await fetch(longUrl);
  const longToken = await longResponse.json();
  if (!longResponse.ok || longToken.error) throw new AppError(longToken.error?.message || 'Could not extend the Instagram access token.', 502, 'INSTAGRAM_TOKEN_FAILED');

  const profileUrl = new URL(`https://graph.instagram.com/${env.META_GRAPH_VERSION}/me`);
  profileUrl.searchParams.set('fields', 'user_id,username');
  profileUrl.searchParams.set('access_token', longToken.access_token);
  const profileResponse = await fetch(profileUrl);
  const profile = await profileResponse.json();
  if (!profileResponse.ok || profile.error || !profile.user_id) throw new AppError(profile.error?.message || 'Could not read the Instagram professional profile.', 502, 'INSTAGRAM_PROFILE_FAILED');

  const account = await SocialAccount.findOneAndUpdate(
    { brandId: owner.brandId, platform: 'instagram' },
    {
      $set: {
        accountId: String(profile.user_id), username: profile.username,
        encryptedAccessToken: encrypt(longToken.access_token),
        tokenExpiresAt: longToken.expires_in ? new Date(Date.now() + longToken.expires_in * 1000) : null,
        connectedBy: owner._id, status: 'connected',
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  await Brand.updateOne({ _id: owner.brandId }, { $set: { instagramAccountId: account._id } });
  res.redirect(`${env.WEB_ORIGIN}/settings?instagram=connected`);
}));

router.delete('/instagram', requireAuth, asyncHandler(async (req, res) => {
  const account = await SocialAccount.findOneAndDelete({ brandId: req.user.brandId, platform: 'instagram' });
  if (account) await Brand.updateOne({ _id: req.user.brandId, instagramAccountId: account._id }, { $set: { instagramAccountId: null, autoPublish: false } });
  res.status(204).end();
}));

export default router;
