'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';

const number = (n = 0) => new Intl.NumberFormat('en').format(n);
const date = (value) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const greeting = new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false }).format(
    new Date(),
  );
  const welcome =
    Number(greeting) < 12
      ? 'Good morning'
      : Number(greeting) < 17
        ? 'Good afternoon'
        : 'Good evening';
  if (error) return <div className="page-error">{error}</div>;
  if (!data)
    return (
      <div className="page-loading">
        <span className="loading-orbit" />
        Setting up your content studio…
      </div>
    );
  const { brand, stats, upcoming, recent, instagram } = data;
  return (
    <div className="dashboard-page">
      <section className="welcome-band">
        <div className="welcome-copy">
          <span className="eyebrow eyebrow-light">
            YOUR SOCIAL STUDIO <span className="eyebrow-dot" />
          </span>
          <h1>
            {welcome}, {brand?.name || 'Imran'}.
          </h1>
          <p>Your brand is ready for its next good idea. Let’s make this week count.</p>
          <div className="welcome-actions">
            <Link href="/content" className="button button-white">
              <Icon name="spark" size={16} />
              Create a post
            </Link>
            <Link href="/calendar" className="button button-quiet">
              View calendar <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
        <div className="welcome-graphic">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">
            <Icon name="spark" size={28} />
          </div>
          <span className="orbit-label orbit-label-one">IDEA</span>
          <span className="orbit-label orbit-label-two">CREATE</span>
          <span className="orbit-label orbit-label-three">PUBLISH</span>
        </div>
        <div className="welcome-foot">
          <span>
            <i /> Weekly rhythm
          </span>
          <strong>{brand?.postsPerWeek || 5} posts / week</strong>
        </div>
      </section>
      <div className="page-section-heading">
        <div>
          <span className="eyebrow">A QUICK READ</span>
          <h2>Your content at a glance</h2>
        </div>
        <span className="last-updated">Updated just now</span>
      </div>
      <section className="stats-grid">
        <Stat
          label="Posts created"
          value={number(stats.total)}
          hint="Across your content library"
          icon="posts"
          tone="blue"
        />
        <Stat
          label="Ready to publish"
          value={number(stats.scheduled)}
          hint="In your upcoming queue"
          icon="calendar"
          tone="violet"
        />
        <Stat
          label="Published"
          value={number(stats.published)}
          hint="Your brand, out in the world"
          icon="trend"
          tone="green"
        />
        <Stat
          label="Drafts"
          value={number(stats.drafts)}
          hint="Ideas to keep shaping"
          icon="spark"
          tone="amber"
        />
      </section>
      <section className="dashboard-columns">
        <div className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COMING UP</span>
              <h2>Next in your queue</h2>
            </div>
            <Link href="/calendar" className="text-link">
              Full calendar <Icon name="arrow" size={14} />
            </Link>
          </div>
          {upcoming.length ? (
            <div className="queue-list">
              {upcoming.map((post) => (
                <div className="queue-row" key={post._id}>
                  <div className="queue-date">
                    <strong>{new Date(post.scheduledAt).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                        new Date(post.scheduledAt),
                      )}
                    </small>
                  </div>
                  <div className="queue-post">
                    <strong>{post.title || post.topic || 'Social post'}</strong>
                    <span>
                      {(post.caption || '').slice(0, 76)}
                      {post.caption?.length > 76 ? '…' : ''}
                    </span>
                  </div>
                  <span className="queue-time">
                    <Icon name="clock" size={14} />
                    {date(post.scheduledAt).split(', ').slice(-1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="calendar" size={20} />
              </span>
              <strong>Your calendar has room to grow.</strong>
              <p>Generate a post and choose when it should go live.</p>
              <Link className="text-link" href="/content">
                Create your first post <Icon name="arrow" size={14} />
              </Link>
            </div>
          )}
        </div>
        <div className="panel rhythm-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR SETUP</span>
              <h2>Keep your rhythm</h2>
            </div>
            <Link
              href="/settings"
              className="icon-button panel-settings"
              aria-label="Brand settings"
            >
              <Icon name="settings" size={17} />
            </Link>
          </div>
          <div className="rhythm-list">
            <Rhythm
              icon="instagram"
              title="Instagram account"
              text={
                instagram?.username
                  ? `Connected as @${instagram.username}`
                  : 'Connect your account to publish'
              }
              status={instagram?.status === 'connected' ? 'complete' : 'pending'}
            />
            <Rhythm
              icon="spark"
              title="Brand voice"
              text={`${brand.voice} · ${brand.niche}`}
              status="complete"
            />
            <Rhythm
              icon="calendar"
              title="Publishing rhythm"
              text={`${brand.postsPerWeek} posts each week`}
              status="complete"
            />
          </div>
          <div className="automation-callout">
            <span className={`automation-icon ${brand.autoPublish ? 'is-on' : ''}`}>
              <Icon name={brand.autoPublish ? 'check' : 'clock'} size={16} />
            </span>
            <span>
              <strong>
                {brand.autoPublish
                  ? 'Your studio is on autopilot'
                  : 'Your studio is ready when you are'}
              </strong>
              <small>
                {brand.autoPublish
                  ? 'Fresh posts are generated and scheduled for you.'
                  : 'Turn on automatic publishing in your brand settings.'}
              </small>
            </span>
            <Link href="/settings" aria-label="Automation settings">
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
      </section>
      <div className="panel-heading recent-heading">
        <div>
          <span className="eyebrow">RECENT ACTIVITY</span>
          <h2>Recently created</h2>
        </div>
        <Link href="/posts" className="text-link">
          View all posts <Icon name="arrow" size={14} />
        </Link>
      </div>
      <section className="recent-grid">
        {recent.slice(0, 3).map((post) => (
          <RecentPost key={post._id} post={post} />
        ))}
        {!recent.length && (
          <div className="panel recent-empty">
            <span className="empty-icon">
              <Icon name="spark" size={20} />
            </span>
            <strong>Your first post starts with a topic.</strong>
            <p>Describe what you want to talk about and Social Flow will shape it into a post.</p>
            <Link href="/content" className="button button-primary">
              Start creating <Icon name="arrow" size={15} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, icon, tone }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="stat-number">{value}</div>
      <strong>{label}</strong>
      <small>{hint}</small>
    </article>
  );
}
function Rhythm({ icon, title, text, status }) {
  return (
    <div className="rhythm-row">
      <span className={`rhythm-icon ${status}`}>
        <Icon name={icon} size={16} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <span className={`rhythm-status ${status}`}>
        {status === 'complete' ? 'Ready' : 'Connect'}
      </span>
    </div>
  );
}
function RecentPost({ post }) {
  return (
    <article className="recent-card">
      {post.imageUrl ? (
        <img src={post.imageUrl} alt="AI generated post artwork" />
      ) : (
        <div className="recent-art">
          <span>
            <Icon name="spark" size={21} />
          </span>
          <small>SOCIAL FLOW / CONTENT STUDIO</small>
        </div>
      )}
      <div className="recent-body">
        <div className="recent-meta">
          <span className={`status-pill status-${post.status}`}>{post.status}</span>
          <span>
            {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
              new Date(post.createdAt),
            )}
          </span>
        </div>
        <strong>{post.title || post.topic || 'Untitled post'}</strong>
        <p>{post.caption}</p>
        <Link href="/posts" className="text-link">
          Open post <Icon name="arrow" size={13} />
        </Link>
      </div>
    </article>
  );
}
