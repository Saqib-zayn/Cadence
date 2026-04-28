import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

const NAV_ITEMS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/progress', icon: 'bar_chart', label: 'Progress' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

function DrawerContents({ pathname, onNav, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-[24px] pt-[24px] flex items-start justify-between">
        <div>
          <div className="text-heading-2 text-text-primary">Cadence</div>
          <div className="text-caption text-text-muted mt-[4px]">Speak better, every day</div>
        </div>
        <button
          onClick={onClose}
          className="w-[32px] h-[32px] flex items-center justify-center text-nav-icon-inactive flex-shrink-0 mt-[2px]"
          aria-label="Close sidebar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
        </button>
      </div>

      <div className="mx-[20px] mt-[24px] mb-[4px] h-px bg-border" />

      <nav className="flex-1 px-[4px] py-[4px]">
        {NAV_ITEMS.map(({ path, icon, label }) => {
          const active = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => onNav(path)}
              className={`h-[52px] flex items-center gap-[12px] px-[16px] rounded-md text-body-medium transition-colors ${
                active ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'
              }`}
              style={{ width: 'calc(100% - 8px)', marginLeft: '4px' }}
            >
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '20px' }}>
                {icon}
              </span>
              {label}
            </button>
          );
        })}

        <div className="mx-[16px] my-[4px] h-px bg-border" />

        <div
          className="h-[52px] flex items-center gap-[12px] px-[16px] rounded-md text-text-muted cursor-default"
          style={{ width: 'calc(100% - 8px)', marginLeft: '4px' }}
        >
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '20px' }}>
            history
          </span>
          <span className="text-body-medium">Past Rounds</span>
          <span className="ml-auto text-caption bg-surface-raised px-[10px] py-[3px] rounded-full">
            Soon
          </span>
        </div>
      </nav>

      <div className="px-[24px] pb-[20px]">
        <div className="text-caption text-text-muted">v0.1.0</div>
      </div>
    </div>
  );
}

export default function AppLayout({ children, title = '', rightIcon = null, onRightIconClick }) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleNav(path) {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  }

  const pushesContent = !isMobile && sidebarOpen;

  return (
    <div className="relative min-h-dvh bg-background">

      {/* Sidebar panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: sidebarOpen ? '260px' : '0px',
          overflow: 'hidden',
          transition: 'width 220ms ease-in-out',
          zIndex: 40,
          backgroundColor: '#f0f0ed',
          borderRight: sidebarOpen ? '1px solid #e2e2de' : 'none',
        }}
      >
        {/* Inner container holds the full 260px width so content never squishes during transition */}
        <div style={{ width: '260px', height: '100%' }}>
          <DrawerContents
            pathname={pathname}
            onNav={handleNav}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </aside>

      {/* Mobile backdrop — sits behind sidebar, closes on tap */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content — shifts right on desktop when sidebar is open */}
      <div
        className="flex flex-col min-h-dvh"
        style={{
          marginLeft: pushesContent ? '260px' : '0px',
          transition: 'margin-left 220ms ease-in-out',
        }}
      >
        {/* Top bar */}
        <header className="h-[52px] flex items-center justify-between px-[24px] flex-shrink-0 relative">
          <button
            className="w-6 h-6 flex items-center justify-center text-nav-icon-inactive"
            onClick={() => setSidebarOpen(open => !open)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
          </button>

          {title && (
            <span className="absolute left-1/2 -translate-x-1/2 text-label text-text-secondary pointer-events-none">
              {title}
            </span>
          )}

          {rightIcon ? (
            <button
              className="w-6 h-6 flex items-center justify-center text-nav-icon-inactive"
              onClick={onRightIconClick}
              aria-label={rightIcon}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{rightIcon}</span>
            </button>
          ) : (
            <div className="w-6 h-6" />
          )}
        </header>

        <main className="flex-1 px-[24px] md:px-[48px] xl:px-[80px] pb-[40px]">
          {children}
        </main>
      </div>
    </div>
  );
}
