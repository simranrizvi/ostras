'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import { api } from '../../../lib/api';
import { usePosts } from '../../../features/posts/use-posts';

const tabs = ['all', 'draft', 'scheduled', 'processing', 'published', 'failed'];
const when = (value) => (value ? new Date(value).toLocaleString() : '');
export default function PostsPage() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const { posts, pagination, loading, error, reload } = usePosts({ page, status, search });
  async function action(post, operation) {
    if (operation === 'delete' && !window.confirm('Delete this draft permanently?')) return;
    if (
      operation === 'publish' &&
      !window.confirm(
        'Publish this post to Instagram now? If a previous attempt was interrupted, check Instagram first to avoid a duplicate.',
      )
    )
      return;
    setBusy(post._id);
    setActionError('');
    setMessage('');
    try {
      const result = await api(
        `/posts/${post._id}${operation === 'delete' ? '' : `/${operation}`}`,
        { method: operation === 'delete' ? 'DELETE' : 'POST' },
      );
      if (operation === 'publish') setMessage(result.message);
      if (operation === 'duplicate') window.location.assign(`/content?post=${result.post._id}`);
      if (operation === 'delete' && posts.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      setActionError(e.message);
      reload();
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="posts-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">YOUR CONTENT LIBRARY</span>
          <h1>Good ideas live here.</h1>
          <p>Search, review and manage your entire publishing queue.</p>
        </div>
        <Link href="/content" className="button button-primary">
          <Icon name="plus" size={17} />
          Create a post
        </Link>
      </div>
      <section className="panel library-panel">
        <div className="library-toolbar">
          <div className="filter-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                aria-pressed={tab === status}
                className={status === tab ? 'filter-tab active' : 'filter-tab'}
                onClick={() => {
                  setStatus(tab);
                  setPage(1);
                }}
              >
                {tab === 'all' ? 'All posts' : tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button className="small-action" onClick={reload} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="library-search">
          <label htmlFor="post-search">Search posts</label>
          <input
            id="post-search"
            type="search"
            maxLength={120}
            placeholder="Title, topic or caption…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {message && (
          <div className="form-success" role="status">
            {message}
          </div>
        )}
        {(error || actionError) && (
          <div className="form-alert library-alert" role="alert">
            {actionError || error}
          </div>
        )}
        {loading ? (
          <div className="empty-state" role="status">
            Loading posts…
          </div>
        ) : posts.length ? (
          <div className="post-list">
            {posts.map((post) => (
              <article className="post-row" key={post._id}>
                <div className="post-thumb">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <Icon name="image" />
                  )}
                </div>
                <div className="post-row-copy">
                  <div className="post-row-top">
                    <strong>{post.title || post.topic || 'Untitled post'}</strong>
                    <span className={`status-pill status-${post.status}`}>{post.status}</span>
                  </div>
                  <p>{post.caption}</p>
                  <div className="post-row-meta">
                    <span>{when(post.scheduledAt || post.createdAt)}</span>
                  </div>
                  {post.errorMessage && <p className="error-inline">{post.errorMessage}</p>}
                </div>
                <div className="post-row-actions" aria-busy={busy === post._id}>
                  {['draft', 'failed', 'scheduled'].includes(post.status) && (
                    <Link className="small-action" href={`/content?post=${post._id}`}>
                      Edit
                    </Link>
                  )}
                  {['draft', 'failed'].includes(post.status) && (
                    <button
                      className="small-action"
                      disabled={Boolean(busy)}
                      onClick={() => action(post, 'publish')}
                    >
                      Publish now
                    </button>
                  )}
                  {post.status === 'scheduled' && (
                    <button
                      className="small-action"
                      disabled={Boolean(busy)}
                      onClick={() => action(post, 'unschedule')}
                    >
                      Return to draft
                    </button>
                  )}
                  <button
                    className="small-action"
                    disabled={Boolean(busy)}
                    onClick={() => action(post, 'duplicate')}
                  >
                    Duplicate
                  </button>
                  {['draft', 'failed'].includes(post.status) && (
                    <button
                      className="small-action error-inline"
                      disabled={Boolean(busy)}
                      onClick={() => action(post, 'delete')}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state library-empty">
            <strong>No posts found.</strong>
            <p>Try another search or create a new draft.</p>
          </div>
        )}
        <div className="pagination" aria-label="Post pagination">
          <span>
            {pagination.total} results · Page {page} of {Math.max(1, pagination.pages)}
          </span>
          <button
            className="button button-secondary"
            disabled={loading || page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            className="button button-secondary"
            disabled={loading || page >= pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
