'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import { api } from '../../../lib/api';

const tabs = ['all', 'draft', 'scheduled', 'published', 'failed'];
const when = (value) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';

export default function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const filtered = useMemo(() => status === 'all' ? posts : posts.filter((post) => post.status === status), [posts, status]);
  async function load() { try { const result = await api('/posts?limit=50'); setPosts(result.posts); } catch (e) { setError(e.message); } }
  useEffect(() => { void load(); }, []);
  async function remove(id) { setBusyId(id); try { await api(`/posts/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); } finally { setBusyId(''); } }
  async function publish(id) { setBusyId(id); setError(''); try { await api(`/posts/${id}/publish`, { method: 'POST' }); await load(); } catch (e) { setError(e.message); await load(); } finally { setBusyId(''); } }

  return <div className="posts-page"><div className="page-header"><div><span className="eyebrow">YOUR CONTENT LIBRARY</span><h1>Good ideas live here.</h1><p>Everything you’ve created, ready to share on your terms.</p></div><Link href="/content" className="button button-primary"><Icon name="plus" size={17}/>Create a post</Link></div>
    <section className="panel library-panel"><div className="library-toolbar"><div className="filter-tabs">{tabs.map((tab) => <button key={tab} className={status === tab ? 'filter-tab active' : 'filter-tab'} onClick={() => setStatus(tab)}>{tab === 'all' ? 'All posts' : tab[0].toUpperCase() + tab.slice(1)}<span>{tab === 'all' ? posts.length : posts.filter((post) => post.status === tab).length}</span></button>)}</div><span className="library-count">Showing {filtered.length} of {posts.length}</span></div>{error && <div className="form-alert library-alert">{error}</div>}
      {filtered.length ? <div className="post-list">{filtered.map((post) => <article className="post-row" key={post._id}><div className="post-thumb">{post.imageUrl ? <img src={post.imageUrl} alt=""/> : <span><Icon name="spark" size={19}/></span>}</div><div className="post-row-copy"><div className="post-row-top"><strong>{post.title || post.topic || 'Untitled post'}</strong><span className={`status-pill status-${post.status}`}>{post.status}</span></div><p>{post.caption}</p><div className="post-row-meta"><span>{post.topic || 'General topic'}</span><i/> <span>{post.status === 'scheduled' ? `Scheduled ${when(post.scheduledAt)}` : post.status === 'published' ? `Published ${when(post.publishedAt)}` : `Created ${when(post.createdAt)}`}</span>{post.errorMessage && <span className="error-inline">· {post.errorMessage}</span>}</div></div><div className="post-row-actions">{['draft', 'failed'].includes(post.status) && <button className="small-action" disabled={busyId === post._id} onClick={() => publish(post._id)}>{busyId === post._id ? 'Working…' : 'Publish now'} <Icon name="arrow" size={13}/></button>}{['draft', 'failed'].includes(post.status) && <button className="icon-button delete-action" aria-label="Delete post" disabled={busyId === post._id} onClick={() => remove(post._id)}>×</button>}</div></article>)}</div> : <div className="empty-state library-empty"><span className="empty-icon"><Icon name="posts" size={21}/></span><strong>{status === 'all' ? 'A blank page is a good place to start.' : `No ${status} posts yet.`}</strong><p>{status === 'all' ? 'Create your first post or set your brand to publish on a rhythm.' : 'Posts will show up here as your content moves through the studio.'}</p>{status === 'all' && <Link href="/content" className="button button-primary">Create your first post <Icon name="arrow" size={15}/></Link>}</div>}</section>
  </div>;
}
