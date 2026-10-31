"use client";

import Link from 'next/link';
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import React, { useEffect } from 'react';

export function useNavigate() {
  const router = useRouter();
  return (to: string) => router.push(to);
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [replace, router, to]);
  return null;
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void,
] {
  const current = useNextSearchParams();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const params = new URLSearchParams(current?.toString() ?? '');

  const setParams = (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => {
    const query = next instanceof URLSearchParams ? next.toString() : new URLSearchParams(next).toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (options?.replace) router.replace(href);
    else router.push(href);
  };

  return [params, setParams];
}

export function NavLink({
  to,
  end = false,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const targetPath = to.split('?')[0] || '/';
  const isActive = end ? pathname === targetPath : targetPath === '/' ? pathname === '/' : pathname.startsWith(targetPath);
  const resolvedClass = typeof className === 'function' ? className({ isActive }) : className;

  return (
    <Link href={to} className={resolvedClass}>
      {children}
    </Link>
  );
}