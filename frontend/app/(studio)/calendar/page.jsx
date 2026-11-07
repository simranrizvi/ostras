'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import { api } from '../../../lib/api';

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const readableDate = (date) => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);

export default function CalendarPage() {
  const [posts, setPosts] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { api('/posts?limit=50&status=scheduled').then((data) => setPosts(data.posts)).catch((e) => setError(e.message)); }, []);
  const start = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7); d.setHours(0, 0, 0, 0); return d; }, [weekOffset]);
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return d; });
  const visible = posts.filter((post) => { const d = new Date(post.scheduledAt); return d >= start && d < new Date(start.getTime() + 7 * 86_400_000); });
  const range = `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(days[0])} — ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(days[6])}`;
  return <div className="calendar-page"><div className="page-header"><div><span className="eyebrow">PLAN AHEAD</span><h1>A little structure. A lot of room.</h1><p>See what’s on the way and keep your publishing rhythm steady.</p></div><Link href="/content" className="button button-primary"><Icon name="plus" size={16}/>Create a post</Link></div>
    <section className="panel calendar-panel"><div className="calendar-toolbar"><div><span className="eyebrow">WEEKLY VIEW</span><h2>{range}</h2></div><div className="calendar-controls"><button className="icon-button" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week"><span>‹</span></button><button className="button button-secondary today-button" onClick={() => setWeekOffset(0)}>Today</button><button className="icon-button" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week"><span>›</span></button></div></div>{error && <div className="form-alert">{error}</div>}
      <div className="week-grid">{days.map((date, index) => { const matches = visible.filter((post) => dayKey(new Date(post.scheduledAt)) === dayKey(date)); const isToday = dayKey(new Date()) === dayKey(date); return <div className={`week-day ${isToday ? 'week-day-today' : ''}`} key={date.toISOString()}><div className="week-day-head"><span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date)}</span><strong>{date.getDate()}</strong></div><div className="week-events">{matches.map((post) => <article className="calendar-event" key={post._id}><span className="event-time">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(post.scheduledAt))}</span><strong>{post.title || post.topic || 'Instagram post'}</strong><small>{post.caption.slice(0, 72)}{post.caption.length > 72 ? '…' : ''}</small></article>)}{!matches.length && index === 2 && <div className="calendar-empty-hint"><Icon name="spark" size={14}/><span>Room for a good idea</span></div>}</div></div>; })}</div>
      {visible.length === 0 && <div className="calendar-empty-bottom"><span className="empty-icon"><Icon name="calendar" size={19}/></span><strong>Your week is open.</strong><p>Generate a post or turn on automatic publishing to fill your calendar.</p><Link href="/settings" className="text-link">Set your publishing rhythm <Icon name="arrow" size={14}/></Link></div>}
    </section><div className="calendar-note"><span><Icon name="clock" size={15}/></span><p>Times appear in your workspace timezone. <Link href="/settings">Change timezone</Link></p></div>
  </div>;
}
