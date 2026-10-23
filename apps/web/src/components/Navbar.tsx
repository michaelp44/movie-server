'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const { user, ntfyTopic, ntfySubscribeUrl, ntfyWebUrl, logout } = useAuth();
  const overflowMenuRef = useRef<HTMLDetailsElement>(null);

  const navItems = [
    { href: '/', label: 'Search' },
    { href: '/recommendations', label: 'Recommendations' },
    { href: '/wanted', label: 'Auto Download' },
    { href: '/poker', label: 'Poker' },
  ];
  const overflowItems = [
    { href: '/downloads', label: 'Downloads' },
    { href: '/change-password', label: 'Change Password' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const closeOverflowMenu = () => {
    if (overflowMenuRef.current) {
      overflowMenuRef.current.open = false;
    }
  };

  useEffect(() => {
    closeOverflowMenu();
  }, [pathname]);

  const copyNtfyTopic = async () => {
    if (!ntfyTopic) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ntfyTopic);
      }
    } catch {
      // The fallback web page still shows the topic if clipboard access is unavailable.
    }
  };

  const handleNtfySubscribe = async () => {
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid && ntfySubscribeUrl) {
      window.location.href = ntfySubscribeUrl;
      return;
    }

    await copyNtfyTopic();

    if (ntfyWebUrl) {
      window.location.href = ntfyWebUrl;
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                🎬 Movie Server
              </span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            {user && (
              <div className="flex items-center space-x-4">
                {(ntfySubscribeUrl || ntfyWebUrl) && (
                  <button
                    type="button"
                    onClick={handleNtfySubscribe}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 sm:h-auto sm:w-auto sm:px-0 sm:text-sm"
                    title={ntfyTopic ? `Subscribe to ntfy topic: ${ntfyTopic}` : 'Subscribe to ntfy'}
                    aria-label={ntfyTopic ? `Subscribe to ntfy topic: ${ntfyTopic}` : 'Subscribe to ntfy'}
                  >
                    <span aria-hidden="true">🔔</span>
                    <span className="ml-1 hidden sm:inline">Subscribe</span>
                  </button>
                )}
                {user.username === 'admin' ? (
                  <Link
                    href="/admin"
                    className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {user.username}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {user.username}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary text-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      <div className="sm:hidden border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-1 px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeOverflowMenu}
              className={`flex-1 text-center px-1 py-2 text-xs font-medium rounded-md ${
                pathname === item.href
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="relative">
            <details ref={overflowMenuRef} className="group">
              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-lg font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 [&::-webkit-details-marker]:hidden">
                ...
              </summary>
              <div className="absolute right-0 top-11 z-20 min-w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {overflowItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeOverflowMenu}
                    className={`block px-3 py-2 text-sm font-medium ${
                      pathname === item.href
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </nav>
  );
}
