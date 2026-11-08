'use client';
export default function ErrorPage({ reset }) {
  return (
    <div className="empty-state" role="alert">
      <h1>This page could not load.</h1>
      <p>Please try again.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
