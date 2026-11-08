'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import Icon from './Icon';

const links = [
  { href: '/', label: 'Overview', icon: 'home' },
  { href: '/content', label: 'Create content', icon: 'spark' },
  { href: '/posts', label: 'Post library', icon: 'posts' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/settings', label: 'Brand settings', icon: 'settings' },
];

export default function AppShell({ children, title }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const expired = () => router.replace('/login');
    window.addEventListener('session-expired', expired);
    api('/auth/me', { signal: controller.signal })
      .then(setSession)
      .catch((e) => {
        if (!controller.signal.aborted) {
          if (e.status === 401) expired();
          else setSessionError(e.message);
        }
      });
    return () => {
      controller.abort();
      window.removeEventListener('session-expired', expired);
    };
  }, [router]);

  async function signOut() {
    try {
      await api('/auth/logout', { method: 'POST' });
      router.replace('/login');
    } catch (e) {
      setSessionError(e.message);
    }
  }

  if (sessionError)
    return (
      <div className="app-loading" role="alert">
        {sessionError}
        <button className="button button-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  if (!session)
    return (
      <div className="app-loading">
        <span className="loading-orbit" />
        Preparing your studio…
      </div>
    );
  const brand = session.brand;
  const initials = (session.user?.name || 'IM')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const currentPage = links.find(
    (link) => path === link.href || (link.href !== '/' && path.startsWith(link.href)),
  );

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <Link href="/" className="brand-lockup" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">
            <Icon name="spark" size={21} />
          </span>
          <span>
            social flow<span className="brand-period">.</span>
            <small>Social Studio</small>
          </span>
        </Link>
        <div className="workspace-chip">
          <span className="workspace-avatar">{(brand?.name || 'O')[0].toUpperCase()}</span>
          <span className="workspace-copy">
            <strong>{brand?.name || 'My workspace'}</strong>
            <small>Workspace</small>
          </span>
          <Icon name="chevron" size={14} className="muted" />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map((link) => {
            const active = path === link.href || (link.href !== '/' && path.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? 'nav-link-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={link.icon} size={18} />
                <span>{link.label}</span>
                {link.href === '/content' && <span className="nav-new">NEW</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="upgrade-card">
          <span className="upgrade-spark">
            <Icon name="spark" size={15} />
          </span>
          <strong>Your brand, always on.</strong>
          <p>One good idea can carry your whole week.</p>
          <Link href="/content">
            Create a post <Icon name="arrow" size={14} />
          </Link>
        </div>
        <button className="profile-row" onClick={signOut}>
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy">
            <strong>{session.user?.name}</strong>
            <small>{session.user?.email}</small>
          </span>
          <Icon name="logout" size={17} className="muted" />
        </button>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={14} />
            <strong>{currentPage?.label || title}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i />
              Studio active
            </span>
            <span className="top-avatar">{initials}</span>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
