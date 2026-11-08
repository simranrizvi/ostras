'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import Icon from '../../components/Icon';

const empty = { title: '', topic: '', caption: '', hashtags: [], imageUrl: '' };
const localTime = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
export default function PostEditor() {
  const [brand, setBrand] = useState(null);
  const [post, setPost] = useState(empty);
  const [mode, setMode] = useState('manual');
  const [withImage, setWithImage] = useState(true);
  const [scheduleAt, setScheduleAt] = useState(localTime(new Date(Date.now() + 3600_000)));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get('post');
    Promise.all([
      api('/brand'),
      id ? api(`/posts/${encodeURIComponent(id)}`) : Promise.resolve(null),
    ])
      .then(([workspace, result]) => {
        if (!active) return;
        setBrand(workspace.brand);
        if (result) {
          setPost(result.post);
          if (result.post.scheduledAt) setScheduleAt(localTime(new Date(result.post.scheduledAt)));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const locked = ['processing', 'published'].includes(post.status);
  function update(field, value) {
    setPost((valueBefore) => ({ ...valueBefore, [field]: value }));
    setMessage('');
  }
  async function persist() {
    const content = Object.fromEntries(
      Object.keys(empty).map((key) => [key, post[key] || empty[key]]),
    );
    const result = await api(post._id ? `/posts/${post._id}` : '/posts', {
      method: post._id ? 'PATCH' : 'POST',
      body: JSON.stringify(content),
    });
    setPost(result.post);
    window.history.replaceState(null, '', `/content?post=${result.post._id}`);
    return result.post;
  }
  async function run(operation) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (operation === 'generate') {
        const result = await api('/posts/generate', {
          method: 'POST',
          body: JSON.stringify({ topic: post.topic, withImage }),
        });
        setPost(result.post);
        window.history.replaceState(null, '', `/content?post=${result.post._id}`);
        setMessage('AI draft saved. Review it before publishing.');
      } else {
        const saved = await persist();
        if (operation === 'save') setMessage('Draft saved.');
        else {
          // Save reviewed content before scheduling or publishing.
          const result = await api(`/posts/${saved._id}/${operation}`, {
            method: 'POST',
            ...(operation === 'schedule'
              ? { body: JSON.stringify({ scheduledAt: new Date(scheduleAt).toISOString() }) }
              : {}),
          });
          setPost(result.post);
          setMessage(
            operation === 'schedule'
              ? 'Added to your calendar.'
              : 'Queued for publishing. Check the library for the result.',
          );
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="page-loading" role="status">
        Loading editor…
      </div>
    );
  return (
    <div className="content-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">THE IDEA WORKSHOP</span>
          <h1>{post._id ? 'Review & refine your post.' : 'Make something worth sharing.'}</h1>
          <p>Write your own draft or generate one with your brand voice.</p>
        </div>
        <Link href="/posts" className="button button-secondary">
          Post library
        </Link>
      </div>
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      <div className="creator-layout">
        <section className="panel settings-panel">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              Write manually
            </button>
            <button
              className={`filter-tab ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => setMode('ai')}
            >
              AI assistant
            </button>
          </div>
          {mode === 'ai' && (
            <div className="editor-fields">
              <label>
                Topic
                <textarea
                  value={post.topic}
                  minLength={3}
                  maxLength={200}
                  rows={3}
                  onChange={(e) => update('topic', e.target.value)}
                />
              </label>
              <label className="image-option">
                <span>Create an image too</span>
                <input
                  type="checkbox"
                  checked={withImage}
                  onChange={(e) => setWithImage(e.target.checked)}
                />
              </label>
              <button
                className="button button-primary"
                disabled={busy || !brand || post.topic.trim().length < 3 || locked}
                onClick={() => run('generate')}
              >
                <Icon name="spark" size={16} />
                {busy ? 'Working…' : 'Generate a new draft'}
              </button>
              <p className="form-footnote">
                Generation creates a separate saved draft. Save edits to your current draft first.
              </p>
            </div>
          )}
          <form
            className="editor-fields"
            onSubmit={(e) => {
              e.preventDefault();
              void run('save');
            }}
          >
            <fieldset disabled={busy || locked || !brand}>
              <label>
                Title
                <input
                  maxLength={140}
                  value={post.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </label>
              <label>
                Caption
                <textarea
                  required
                  minLength={2}
                  maxLength={2200}
                  rows={8}
                  value={post.caption}
                  onChange={(e) => update('caption', e.target.value)}
                />
              </label>
              <label>
                Hashtags
                <input
                  value={post.hashtags.join(' ')}
                  onChange={(e) => update('hashtags', e.target.value.split(/\s+/).filter(Boolean))}
                />
                <small>
                  {[post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n').length}
                  /2,200 characters including hashtags
                </small>
              </label>
              <label>
                Image URL
                <input
                  type="url"
                  placeholder="https://…"
                  value={post.imageUrl}
                  onChange={(e) => update('imageUrl', e.target.value)}
                />
                <small>Use a public HTTPS image suitable for Instagram.</small>
              </label>
              <button className="button button-secondary button-full" type="submit">
                {busy ? 'Working…' : 'Save draft'}
              </button>
              <div className="schedule-editor">
                <label>
                  Publish time (your device timezone)
                  <input
                    type="datetime-local"
                    min={localTime(new Date())}
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button button-primary button-full"
                  disabled={!scheduleAt || !post.caption.trim()}
                  onClick={() => run('schedule')}
                >
                  Save & schedule
                </button>
                <button
                  type="button"
                  className="publish-now"
                  disabled={post.status === 'scheduled' || !post.caption.trim()}
                  onClick={() => {
                    if (window.confirm('Publish this reviewed content to Instagram now?'))
                      void run('publish');
                  }}
                >
                  Save & publish now
                </button>
              </div>
            </fieldset>
          </form>
          {locked && (
            <p>
              This post is {post.status}. Duplicate it from the library to create a new version.
            </p>
          )}
        </section>
        <section className="panel preview-panel">
          <div className="preview-heading">
            <h2>Instagram preview</h2>
            <span className={`status-pill status-${post.status || 'draft'}`}>
              {post.status || 'Unsaved draft'}
            </span>
          </div>
          <div className="post-preview-top">
            <strong>{brand?.name || 'Your brand'}</strong>
          </div>
          {post.imageUrl ? (
            <img className="post-image-preview" src={post.imageUrl} alt="Post artwork" />
          ) : (
            <div className="post-image-placeholder">
              <Icon name="image" />
              <p>Your image will appear here.</p>
            </div>
          )}
          <div className="editor-fields">
            <p className="caption-preview">{post.caption || 'Your caption will appear here.'}</p>
            <p>{post.hashtags.join(' ')}</p>
            {post.errorMessage && <p className="form-alert">{post.errorMessage}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
