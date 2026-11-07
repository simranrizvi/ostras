'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import { api } from '../../../lib/api';

function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function CreateContentPage() {
  const [brand, setBrand] = useState(null);
  const [topic, setTopic] = useState('');
  const [withImage, setWithImage] = useState(true);
  const [post, setPost] = useState(null);
  const [scheduleAt, setScheduleAt] = useState(localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api('/brand').then(({ brand: value }) => { setBrand(value); setTopic(value.topics?.[0] || ''); }).catch((e) => setError(e.message)); }, []);

  async function generate(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setPost(null);
    try { const result = await api('/posts/generate', { method: 'POST', body: JSON.stringify({ topic, withImage }) }); setPost(result.post); setMessage('A new draft is ready. Give it a quick review before it goes live.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveChanges() {
    setBusy(true); setError('');
    try { const result = await api(`/posts/${post._id}`, { method: 'PATCH', body: JSON.stringify({ title: post.title, topic: post.topic, caption: post.caption, hashtags: post.hashtags, imageUrl: post.imageUrl }) }); setPost(result.post); setMessage('Your changes are saved.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function schedulePost() {
    setBusy(true); setError('');
    try { const result = await api(`/posts/${post._id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt: new Date(scheduleAt).toISOString() }) }); setPost(result.post); setMessage('Added to your publishing queue.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function publishNow() {
    setBusy(true); setError('');
    try { const result = await api(`/posts/${post._id}/publish`, { method: 'POST' }); setPost(result.post); setMessage('Your post is published.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="content-page"><div className="page-header"><div><span className="eyebrow">THE IDEA WORKSHOP</span><h1>Make something worth sharing.</h1><p>Give Ostras a topic. We’ll shape it into a post that sounds like your brand.</p></div><Link href="/settings" className="button button-secondary"><Icon name="settings" size={16}/>Brand voice</Link></div>
    <div className="creator-layout"><section className="panel creator-prompt"><div className="panel-heading"><div><span className="step-label"><span>01</span> START WITH A TOPIC</span><h2>What should we talk about?</h2></div></div><form onSubmit={generate}><label className="field-label" htmlFor="topic">Your post idea</label><textarea id="topic" className="topic-input" rows="4" required minLength={3} maxLength={200} placeholder={`A useful insight for people interested in ${brand?.niche || 'your brand'}…`} value={topic} onChange={(e) => setTopic(e.target.value)} /><div className="topic-foot"><span>{topic.length}/200</span><span>Specific topics make stronger posts.</span></div><div className="brand-context"><span className="context-icon"><Icon name="spark" size={16}/></span><span><strong>Writing for {brand?.name || 'your brand'}</strong><small>{brand?.voice || 'Friendly'} voice · {brand?.niche || 'Set your niche in Brand settings'}</small></span><Link href="/settings" className="mini-link">Edit <Icon name="arrow" size={12}/></Link></div><label className={`image-option ${withImage ? 'image-option-on' : ''}`}><span className="image-option-icon"><Icon name="image" size={16}/></span><span><strong>Create an image too</strong><small>Generate original artwork for this post</small></span><input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)}/><span className="toggle-ui"/></label>{error && <div className="form-alert">{error}</div>}{message && <div className="form-success"><Icon name="check" size={15}/>{message}</div>}<button className="button button-primary button-full generate-button" disabled={busy || !brand}>{busy ? <><span className="button-spinner"/> Creating your post…</> : <><Icon name="spark" size={17}/>Generate a first draft<Icon name="arrow" size={16}/></>}</button><p className="form-footnote">You review every post before it is scheduled.</p></form></section>
      <section className={`panel preview-panel ${post ? 'preview-panel-ready' : ''}`}><div className="preview-heading"><div><span className="step-label"><span>02</span> REVIEW & REFINE</span><h2>{post ? 'Your draft is ready.' : 'Your post will appear here.'}</h2></div><span className={`preview-status ${post ? 'preview-status-draft' : ''}`}><i/>{post ? post.status : 'Waiting for an idea'}</span></div>{post ? <div className="post-editor"><div className="post-preview-top"><div className="preview-profile"><span className="preview-avatar">{(brand?.name || 'O')[0].toUpperCase()}</span><span><strong>{brand?.name}</strong><small>Instagram preview</small></span></div><button className="icon-button" title="Instagram preview"><Icon name="instagram" size={18}/></button></div>{post.imageUrl ? <img className="post-image-preview" src={post.imageUrl} alt="Generated artwork for your post"/> : <div className="post-image-placeholder"><span><Icon name="image" size={21}/></span><strong>Add an image when you’re ready</strong><small>Instagram posts need an image to publish.</small></div>}<div className="editor-fields"><label>Post title<input value={post.title || ''} maxLength={140} onChange={(e) => setPost({ ...post, title: e.target.value })}/></label><label>Caption<textarea rows={7} maxLength={2200} value={post.caption || ''} onChange={(e) => setPost({ ...post, caption: e.target.value })}/><span className="char-count">{post.caption?.length || 0}/2,200</span></label><label>Hashtags<input value={(post.hashtags || []).join(' ')} onChange={(e) => setPost({ ...post, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}/></label><button className="button button-secondary button-full" disabled={busy} onClick={saveChanges}>Save edits</button><div className="schedule-editor"><label>Choose a time<input type="datetime-local" min={localDateTime(new Date())} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}/></label><button className="button button-primary button-full" disabled={busy || post.status === 'published'} onClick={schedulePost}><Icon name="calendar" size={16}/>{post.status === 'scheduled' ? 'Update schedule' : 'Add to calendar'}</button><button className="publish-now" disabled={busy || post.status === 'published'} onClick={publishNow}>Publish now <Icon name="arrow" size={14}/></button></div></div></div> : <div className="preview-empty"><div className="preview-card-ghost"><div className="ghost-head"><i/><i/><i/></div><div className="ghost-image"><span><Icon name="spark" size={21}/></span></div><div className="ghost-lines"><i/><i/><i/></div></div><p>We’ll prepare a caption and, if you choose, a custom image.</p></div>}</section></div></div>;
}
