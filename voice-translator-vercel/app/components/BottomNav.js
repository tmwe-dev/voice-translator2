'use client';

import { memo } from 'react';
import { vibrate } from '../lib/constants.js';

const BottomNav = ({ currentView, setView, S, L, theme }) => {
  // Define navigation items with their icons and labels
  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home', views: ['home', 'quickinvite'] },
    { id: 'archive', icon: '📂', label: 'Archivio', views: ['archive', 'history', 'summary', 'contacts'] },
    { id: 'ai', icon: '✨', label: 'AI', views: ['ai', 'interpreter'] },
    { id: 'settings', icon: '⚙️', label: 'Profilo', views: ['settings', 'account', 'credits', 'apikeys', 'voicetest', 'voice-clone', 'help'] },
  ];

  // Views where BottomNav should not be shown
  const hiddenViews = new Set(['room', 'chat', 'lobby', 'join', 'welcome', 'loading', 'detail', 'result']);

  // Check if current view should hide the nav
  if (hiddenViews.has(currentView)) {
    return null;
  }

  // Determine which tab is active
  const activeTab = navItems.find(item => item.views.includes(currentView));

  const handleTabClick = (viewId) => {
    vibrate(15);
    setView(viewId);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '80px',
      backgroundColor: 'rgba(17, 17, 19, 0.96)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${S.cardBorder}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
      zIndex: 50,
      fontFamily: S.fontFamily || "'Inter', sans-serif",
    }}>
      {navItems.map((item) => {
        const isActive = activeTab?.id === item.id;
        const isTabActive = item.views.includes(currentView);

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.views[0])}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 16px',
              backgroundColor: isTabActive ? `rgba(${S.accent1.replace(/[^0-9,]/g, '')}, 0.12)` : 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.25s',
              color: isTabActive ? S.accent1 : S.textMuted,
            }}
            aria-label={item.label}
            aria-current={isTabActive ? 'page' : undefined}
          >
            <div style={{
              fontSize: '22px',
              lineHeight: '1',
            }}>
              {item.icon}
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'inherit',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default memo(BottomNav);
