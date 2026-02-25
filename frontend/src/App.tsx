import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppChrome } from './ui/AppChrome';
import { Library } from './routes/Library';
import { checkWebGLSupport } from './utils/gpuDetection';
import { useMusicLibrary, hydrateFromBackend, clearLibrary } from './music/useMusicLibrary';
import { useAuth } from './auth/AuthContext';
// import { AuthView } from './auth/AuthView'; // uncomment to enforce login

// Lazy load the Player for code splitting
const Player = React.lazy(() => import('./routes/Player').then(m => ({ default: m.Player })));

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

// WebGL Error Fallback (player only)
const WebGLFallback = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 bg-black flex items-center justify-center text-white p-8">
    <div className="text-center">
      <h2 className="text-xl font-bold mb-3">WebGL Not Supported</h2>
      <p className="text-white/60 mb-6">This device/browser cannot run the visualizer scene.</p>
      <button
        type="button"
        onClick={onBack}
        className="uppercase tracking-[0.16em] text-xs text-white/70 hover:text-white transition-colors"
      >
        Return to archive
      </button>
    </div>
  </div>
);

export const App = () => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [view, setView] = useState<'library' | 'player'>('library');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [libraryTags, setLibraryTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const { tracks } = useMusicLibrary();
  // Track previous user value to detect login/logout transitions
  const prevUserRef = useRef<typeof user>(null);

  useEffect(() => {
    setWebGLSupported(checkWebGLSupport());
  }, []);

  // Hydrate library on login; clear it on logout.
  // Kept here (not in AuthContext) to decouple auth from the music domain.
  useEffect(() => {
    const prev = prevUserRef.current;
    prevUserRef.current = user;

    if (authLoading) return;

    if (user && !prev) {
      void hydrateFromBackend().catch((err: unknown) => {
        console.error('[Auvi] Failed to load library from server:', err);
      });
    } else if (!user && prev) {
      clearLibrary();
    }
  }, [user, authLoading]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  // Commented out for now — re-enable to require login before accessing the app.
  // if (authLoading) return <LoadingSpinner />;
  // if (!user) return <AuthView />;
  // ──────────────────────────────────────────────────────────────────────────

  const handleSongSelect = useCallback((url: string) => {
    const index = tracks.findIndex(t => t.url === url);
    setCurrentTrackIndex(index >= 0 ? index : 0);
    setSelectedSongId(url);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setView('player'));
    });
  }, [tracks]);

  const handleTrackChange = useCallback((index: number) => {
    if (index < 0 || index >= tracks.length) return;
    setCurrentTrackIndex(index);
    setSelectedSongId(tracks[index].url);
  }, [tracks]);

  const handleClose = useCallback(() => {
    setView('library');
    setTimeout(() => setSelectedSongId(null), 500);
  }, []);

  const handleTagsChange = useCallback((tags: string[]) => {
    setLibraryTags(tags);
  }, []);

  const handleTagChange = useCallback((tag: string | null) => {
    setActiveTag(tag);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setView('library');
    setSelectedSongId(null);
  }, [logout]);

  return (
    <div className="w-screen h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      <AnimatePresence mode="wait">
        {view === 'library' && (
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            <AppChrome
              variant="library"
              showFooter
              tags={libraryTags}
              activeTag={activeTag}
              onTagChange={handleTagChange}
              onLogout={user ? handleLogout : undefined}
            >
              <Library onEnterPlayer={handleSongSelect} selectedSongId={selectedSongId} activeTag={activeTag} onTagsChange={handleTagsChange} />
            </AppChrome>
          </motion.div>
        )}

        {view === 'player' && (
          <Suspense fallback={<LoadingSpinner />}>
            <motion.div
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              {webGLSupported ? (
                <AppChrome variant="player" onClose={handleClose} showFooter={false}>
                  <Player
                    songId={selectedSongId}
                    tracks={tracks}
                    trackIndex={currentTrackIndex}
                    onTrackChange={handleTrackChange}
                    onBack={handleClose}
                  />
                </AppChrome>
              ) : (
                <WebGLFallback onBack={handleClose} />
              )}
            </motion.div>
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};
