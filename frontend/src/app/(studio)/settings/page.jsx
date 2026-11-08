'use client';

import { useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { api, API_URL_PUBLIC } from '../../../lib/api';

const timezones = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [instagram, setInstagram] = useState(null);
  const [n8n, setN8n] = useState({ configured: false });
  const [n8nBusy, setN8nBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    api('/brand')
      .then(({ brand, instagram: account }) => {
        setForm({
          ...brand,
          goals: brand.goals || [],
          topics: brand.topics || [],
          preferredTimes: brand.preferredTimes?.length ? brand.preferredTimes : ['10:00'],
          autoGenerateImages: brand.autoGenerateImages !== false,
        });
        setInstagram(account);
      })
      .catch((e) => setError(e.message));
    api('/integrations/n8n/status')
      .then(setN8n)
      .catch(() => setN8n({ configured: false }));
    const params = new URLSearchParams(window.location.search);
    if (params.get('instagram') === 'connected')
      setMessage('Instagram is connected. Your studio is ready to publish.');
    if (params.get('instagram') === 'failed')
      setError('Instagram could not be connected. Check your Meta app settings and try again.');
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/brand', {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          goals:
            typeof form.goals === 'string'
              ? form.goals
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean)
              : form.goals,
          topics:
            typeof form.topics === 'string'
              ? form.topics
                  .split('\n')
                  .map((x) => x.trim())
                  .filter(Boolean)
              : form.topics,
        }),
      });
      setForm({ ...data.brand, autoGenerateImages: data.brand.autoGenerateImages !== false });
      setMessage('Your brand settings are saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      await api('/integrations/instagram', { method: 'DELETE' });
      setInstagram(null);
      setForm((current) => ({ ...current, autoPublish: false }));
      setMessage('Instagram has been disconnected.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function testN8n() {
    setN8nBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/integrations/n8n/test', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setN8nBusy(false);
    }
  }

  if (!form && error)
    return (
      <div role="alert" className="form-alert">
        {error}
        <button className="button button-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  if (!form)
    return (
      <div className="page-loading">
        <span className="loading-orbit" />
        Loading your brand settings…
      </div>
    );
  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">MAKE IT SOUND LIKE YOU</span>
          <h1>Your brand, your way.</h1>
          <p>
            Set the context once. Social Flow uses it to make every post feel more like your brand.
          </p>
        </div>
        <button className="button button-primary" form="brand-settings-form" disabled={busy}>
          <Icon name="check" size={16} />
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      {error && <div className="form-alert settings-alert">{error}</div>}
      {message && (
        <div className="form-success settings-alert">
          <Icon name="check" size={15} />
          {message}
        </div>
      )}
      <form id="brand-settings-form" onSubmit={save} className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Icon name="spark" size={18} />
              </span>
              <div>
                <h2>Brand foundation</h2>
                <p>Give Social Flow the basics behind your business.</p>
              </div>
            </div>
            <div className="settings-fields">
              <label>
                Brand name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </label>
              <label>
                What do you do?
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Your niche or industry"
                  value={form.niche}
                  onChange={(e) => update('niche', e.target.value)}
                />
              </label>
              <label className="span-two">
                Who are you creating for?
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the people you want to reach…"
                  value={form.audience || ''}
                  onChange={(e) => update('audience', e.target.value)}
                />
              </label>
              <label>
                Brand voice
                <select value={form.voice} onChange={(e) => update('voice', e.target.value)}>
                  {['Friendly', 'Expert', 'Bold', 'Minimal', 'Inspirational'].map((voice) => (
                    <option key={voice}>{voice}</option>
                  ))}
                </select>
                <small className="field-caption">
                  The feel of your captions and calls to action.
                </small>
              </label>
              <label>
                Goals
                <input
                  value={Array.isArray(form.goals) ? form.goals.join(', ') : form.goals}
                  onChange={(e) => update('goals', e.target.value)}
                  placeholder="Build awareness, grow community"
                />
                <small className="field-caption">Separate goals with commas.</small>
              </label>
              <label className="span-two">
                Topics to draw from
                <textarea
                  rows={4}
                  placeholder={'Your best advice\nBehind the scenes\nCustomer questions'}
                  value={Array.isArray(form.topics) ? form.topics.join('\n') : form.topics}
                  onChange={(e) => update('topics', e.target.value)}
                />
                <small className="field-caption">
                  Add one topic per line. Automatic posts rotate through these ideas.
                </small>
              </label>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Icon name="calendar" size={18} />
              </span>
              <div>
                <h2>Your publishing rhythm</h2>
                <p>Choose a realistic pace and the times your audience is around.</p>
              </div>
            </div>
            <div className="settings-fields">
              <label>
                Posts each week
                <select
                  value={form.postsPerWeek}
                  onChange={(e) => update('postsPerWeek', Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'post' : 'posts'} a week
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Workspace timezone
                <select value={form.timezone} onChange={(e) => update('timezone', e.target.value)}>
                  {timezones.map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label className="span-two">
                Preferred publish time
                <input
                  type="time"
                  value={form.preferredTimes?.[0] || '10:00'}
                  onChange={(e) => update('preferredTimes', [e.target.value])}
                />
                <small className="field-caption">
                  Social Flow uses this time for each scheduled publishing day.
                </small>
              </label>
            </div>
          </section>
          <section className="panel settings-panel integration-panel">
            <div className="settings-section-title">
              <span className="instagram-settings-icon">
                <Icon name="instagram" size={19} />
              </span>
              <div>
                <h2>Instagram account</h2>
                <p>Connect a professional Instagram account to publish from Social Flow.</p>
              </div>
            </div>
            {instagram?.username ? (
              <div className="connected-account">
                <span className="connected-avatar">@</span>
                <span>
                  <strong>@{instagram.username}</strong>
                  <small>Connected · Instagram Professional</small>
                </span>
                <button
                  type="button"
                  className="button button-secondary disconnect-button"
                  disabled={busy}
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="connect-account">
                <div>
                  <strong>Your account is not connected yet.</strong>
                  <small>Connect an Instagram Business or Creator account through Meta.</small>
                </div>
                <a
                  className="button button-secondary"
                  href={`${API_URL_PUBLIC}/api/integrations/instagram/connect`}
                >
                  <Icon name="instagram" size={16} />
                  Connect Instagram
                  <Icon name="arrow" size={14} />
                </a>
              </div>
            )}
            <p className="integration-note">
              Instagram publishing requires a configured Meta developer app, a public HTTPS image
              URL, and an Instagram Professional account.
            </p>
          </section>
          <section className="panel settings-panel integration-panel">
            <div className="settings-section-title">
              <span className="settings-icon">
                <Icon name="spark" size={18} />
              </span>
              <div>
                <h2>n8n workflow automation</h2>
                <p>Connect Social Flow events to your own n8n workflows.</p>
              </div>
              <span
                className={`status-pill ${n8n.configured ? 'status-published' : 'status-draft'}`}
              >
                {n8n.configured ? 'Connected' : 'Not configured'}
              </span>
            </div>
            <div className="n8n-integration-row">
              <div>
                <strong>Event webhook</strong>
                <small>
                  Post created, scheduled, published, or failed events can trigger n8n actions.
                </small>
              </div>
              <button
                type="button"
                className="button button-secondary"
                disabled={!n8n.configured || n8nBusy}
                onClick={testN8n}
              >
                {n8nBusy ? 'Sending…' : 'Send test event'}
              </button>
            </div>
            <p className="integration-note">
              Configure the n8n webhook URL and signing secret in the backend environment. Import
              the starter workflow from <code>n8n/social-flow-events.workflow.json</code>.
            </p>
          </section>
        </div>
        <aside className="settings-side">
          <section className="panel automation-panel">
            <span className="automation-heading">
              <span className="settings-icon">
                <Icon name="spark" size={18} />
              </span>
              <span>
                <strong>Let Social Flow handle the rhythm</strong>
                <small>Fresh ideas, ready when you need them.</small>
              </span>
            </span>
            <div className="automation-divider" />
            <label className="automation-toggle">
              <span>
                <strong>Automatic publishing</strong>
                <small>
                  Generate and schedule posts from your topics. Posts publish to Instagram
                  automatically.
                </small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.autoPublish)}
                onChange={(e) => update('autoPublish', e.target.checked)}
              />
              <span className="toggle-ui" />
            </label>
            <div className="automation-divider" />
            <label className="automation-toggle">
              <span>
                <strong>Generate post images</strong>
                <small>Instagram needs an image for every automatic post.</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.autoGenerateImages)}
                disabled={form.autoPublish}
                onChange={(e) => update('autoGenerateImages', e.target.checked)}
              />
              <span className="toggle-ui" />
            </label>
            {(!instagram || !form.topics?.length) && (
              <div className="automation-requirements">
                <strong>Before switching on</strong>
                <span>
                  {!instagram && (
                    <i>
                      <b>1</b> Connect Instagram
                    </i>
                  )}
                  {!form.topics?.length && (
                    <i>
                      <b>{instagram ? 1 : 2}</b> Add at least one topic
                    </i>
                  )}
                </span>
              </div>
            )}
            <button
              type="submit"
              form="brand-settings-form"
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save automation settings'}
              <Icon name="arrow" size={15} />
            </button>
          </section>
          <section className="privacy-note">
            <Icon name="check" size={17} />
            <p>
              Your Instagram access token is encrypted before it is stored. Social Flow only uses it
              to publish posts you schedule or approve.
            </p>
          </section>
        </aside>
      </form>
    </div>
  );
}
