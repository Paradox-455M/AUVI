import React, { useState, useEffect } from 'react';

const formatTimeWithTz = () => {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const shortTz = tz.split('/').pop()?.replace(/_/g, ' ') ?? 'Local';
  const time = Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const offset = -now.getTimezoneOffset() / 60;
  const gmt = offset >= 0 ? `GMT+${offset}` : `GMT${offset}`;
  return { line: `${shortTz} ${time} (${gmt})`, timeOnly: time };
};

export const LocationTime: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [t, setT] = useState(formatTimeWithTz);
  useEffect(() => {
    const id = setInterval(() => setT(formatTimeWithTz()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={`timer-mono ${className}`}>{t.line}</span>;
};

export const Brand: React.FC<{ onClick?: () => void; className?: string }> = ({ onClick, className = '' }) => (
  <span
    role={onClick ? 'button' : undefined}
    onClick={onClick}
    className={`font-display text-lg tracking-tight text-[var(--color-text-primary)] ${onClick ? 'cursor-pointer hover:underline' : ''} ${className}`}
    style={{ fontFamily: 'var(--font-display)' }}
  >
    Auvi
  </span>
);

export const Footer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={`nav-label flex items-center gap-6 ${className}`}>
    <span>© {new Date().getFullYear()} Auvi</span>
    <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Privacy</a>
    <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Contact</a>
  </footer>
);

interface AppChromeProps {
  variant: 'library' | 'player';
  onClose?: () => void;
  onLogout?: () => void;
  showFooter?: boolean;
  children: React.ReactNode;
  tags?: string[];
  activeTag?: string | null;
  onTagChange?: (tag: string | null) => void;
}

export const AppChrome: React.FC<AppChromeProps> = ({
  variant,
  onClose,
  onLogout,
  showFooter = true,
  children,
  tags,
  activeTag,
  onTagChange,
}) => {
  return (
    <div className="relative w-full h-full min-h-0 flex flex-col bg-[var(--color-bg-primary)]">
      {/* Top bar: brand (left), time (right) — on player also show Close */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 md:px-12 py-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-8">
          <Brand />
        </div>
        <div className="flex items-center gap-6">
          <LocationTime className="hidden sm:block" />
          {variant === 'player' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="nav-label hover:text-[var(--color-text-primary)] hover:underline transition-colors"
            >
              Close
            </button>
          )}
          {variant === 'library' && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="nav-label text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {variant === 'library' && (tags ?? []).length > 0 && (
        <nav className="filter-nav" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => onTagChange?.(null)}
            className={`nav-label transition-opacity ${activeTag === null ? 'text-[var(--color-text-primary)] opacity-100' : 'opacity-40 hover:opacity-70'}`}
          >All</button>
          {(tags ?? []).map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagChange?.(tag)}
              className={`nav-label transition-opacity ${activeTag === tag ? 'text-[var(--color-text-primary)] opacity-100 underline underline-offset-4' : 'opacity-40 hover:opacity-70'}`}
            >{tag}</button>
          ))}
        </nav>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>

      {showFooter && variant === 'library' && (
        <div className="flex-shrink-0 px-6 md:px-12 py-6 border-t border-[var(--color-border)]">
          <Footer />
        </div>
      )}
    </div>
  );
};
