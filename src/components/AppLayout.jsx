import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/progress', icon: 'bar_chart', label: 'Progress' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

function DrawerContents({ pathname, onNav }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-[24px] pt-[24px]">
        <div className="text-heading-2 text-text-primary">Cadence</div>
        <div className="text-caption text-text-muted mt-[4px]">Speak better, every day</div>
      </div>

      <div className="mx-[20px] mt-[24px] mb-[4px] h-px bg-border" />

      <nav className="flex-1 px-[4px] py-[4px]">
        {NAV_ITEMS.map(({ path, icon, label }) => {
          const active = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => onNav(path)}
              className={`w-full h-[52px] flex items-center gap-[12px] px-[16px] mx-[4px] rounded-md text-body-medium transition-colors ${
                active ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'
              }`}
              style={{ width: 'calc(100% - 8px)' }}
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
          className="w-full h-[52px] flex items-center gap-[12px] px-[16px] mx-[4px] rounded-md text-text-muted cursor-default"
          style={{ width: 'calc(100% - 8px)' }}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleNav(path) {
    navigate(path);
    setDrawerOpen(false);
  }

  return (
    <div className="relative min-h-dvh bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[260px] flex-col bg-drawer-bg border-r border-border">
        <DrawerContents pathname={pathname} onNav={handleNav} />
      </aside>

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col bg-drawer-bg rounded-tr-xl rounded-br-xl shadow-lg md:hidden"
        style={{
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: drawerOpen ? 'transform 200ms ease-out' : 'transform 180ms ease-in',
        }}
      >
        <DrawerContents pathname={pathname} onNav={handleNav} />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 md:ml-[260px] min-w-0">
        {/* Top bar */}
        <header className="h-[52px] flex items-center justify-between px-[24px] flex-shrink-0 relative">
          <button
            className="md:hidden w-6 h-6 flex items-center justify-center text-nav-icon-inactive"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
          </button>
          <div className="md:hidden" />

          {title && (
            <span className="absolute left-1/2 -translate-x-1/2 text-label text-text-secondary pointer-events-none">
              {title}
            </span>
          )}
          {!title && (
            <span className="hidden md:block absolute left-1/2 -translate-x-1/2 text-label text-text-secondary pointer-events-none">
              Cadence
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
