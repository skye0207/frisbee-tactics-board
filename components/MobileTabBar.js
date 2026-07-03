'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Compass, Sparkles } from 'lucide-react';

export default function MobileTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    { href: '/community', label: '战术广场', icon: Compass, match: (p) => p === '/' || p.startsWith('/community') },
    { href: '/tactics', label: '我的战术', icon: Sparkles, match: (p) => p === '/tactics' || p.startsWith('/tactics/') }
  ];
  return (
    <nav className="mobile-tabbar" aria-label="主导航">
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname || '/');
        return (
          <button
            key={href}
            className={`mobile-tabbar__item${active ? ' mobile-tabbar__item--active' : ''}`}
            onClick={() => router.push(href)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
