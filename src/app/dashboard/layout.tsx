'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  PenSquare, 
  Users, 
  BarChart3, 
  Radar,
  Settings, 
  Brain, 
  ChevronLeft, 
  ChevronRight,
  Menu
} from 'lucide-react';

const navigation = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Strategy', href: '/dashboard/strategy', icon: CalendarDays },
  { name: 'Content', href: '/dashboard/content', icon: PenSquare },
  { name: 'Influencers', href: '/dashboard/influencers', icon: Users },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Radar', href: '/dashboard/radar', icon: Radar },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openai');
  const pathname = usePathname();

  // Handle window resizing
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile(); // Check on mount
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse sidebar on mobile, auto-expand on desktop
  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  // Collapse sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile && !collapsed) {
      setCollapsed(true);
    }
  }, [pathname]); // we omit isMobile/collapsed intentionally here to avoid loop, or we can just let it be.

  useEffect(() => {
    // Read provider on mount
    setCurrentProvider(localStorage.getItem('sa_provider') || 'openai');
    
    // Listen for storage changes in case they update settings in another tab
    const handleStorageChange = () => {
      setCurrentProvider(localStorage.getItem('sa_provider') || 'openai');
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for same-tab updates
    const handleCustomChange = () => {
      setCurrentProvider(localStorage.getItem('sa_provider') || 'openai');
    };
    window.addEventListener('sa_settings_updated', handleCustomChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sa_settings_updated', handleCustomChange);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {!collapsed && isMobile && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-20 md:hidden" 
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`flex flex-col bg-gray-900 text-white transition-all duration-300 z-30 fixed md:relative h-full ${
          collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 bg-gray-950">
          <div className={`flex items-center space-x-3 overflow-hidden ${collapsed ? 'hidden md:flex justify-center w-full' : ''}`}>
            <Brain className="w-8 h-8 text-indigo-500 flex-shrink-0" />
            {!collapsed && <span className="text-lg font-bold truncate">Sensitivity Analyser</span>}
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white flex-shrink-0 ml-2"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (pathname?.startsWith(`${item.href}/`) && item.href !== '/dashboard');
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-gray-700/50 text-white border-l-4 border-indigo-500 pl-1.5'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent pl-2.5'
                }`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon
                  className={`flex-shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-gray-300'
                  } ${collapsed ? 'mr-0 mx-auto w-6 h-6' : 'mr-3 w-5 h-5'}`}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md"
            >
              <Menu size={24} />
            </button>
          </div>
          
          <h1 className="text-xl font-semibold text-gray-800 hidden md:block">
            {navigation.find(n => pathname === n.href || (pathname?.startsWith(`${n.href}/`) && n.href !== '/dashboard'))?.name || 'Dashboard'}
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full">
              <span className="w-2 h-2 mr-2 bg-indigo-500 rounded-full animate-pulse"></span>
              Provider: {currentProvider}
            </div>
            {/* User profile dropdown placeholder */}
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium text-white shadow-sm ring-2 ring-white cursor-pointer">
              U
            </div>
          </div>
        </header>

        {/* Main Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
