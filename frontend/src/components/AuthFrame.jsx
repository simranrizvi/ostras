import Link from 'next/link';
import Icon from './Icon';

export default function AuthFrame({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link href="/login" className="brand-lockup auth-logo">
          <span className="brand-mark">
            <Icon name="spark" size={21} />
          </span>
          <span>
            social flow<span className="brand-period">.</span>
            <small>Social Studio</small>
          </span>
        </Link>
        <div className="auth-art">
          <span className="art-kicker">
            <i /> A calmer way to show up
          </span>
          <h2>
            Make good
            <br />
            ideas <em>go further.</em>
          </h2>
          <p>
            Your brand has a story. Social Flow helps you tell it, one thoughtful post at a time.
          </p>
          <div className="art-note">
            <span className="note-dot" />
            <span>
              <strong>YOUR NEXT POST IS TAKING SHAPE</strong>
              <small>From first idea to published.</small>
            </span>
            <Icon name="arrow" size={16} />
          </div>
        </div>
        <div className="auth-visual-bottom">
          <span>Make every week count.</span>
          <span>01 — 04</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-content">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <p className="auth-legal">
            Instagram access tokens are encrypted before they are stored.
          </p>
        </div>
        <span className="auth-panel-corner">SOCIAL FLOW / SOCIAL STUDIO</span>
      </section>
    </main>
  );
}
