import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-12', className)} aria-hidden>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f7cf8" />
          <stop offset="1" stopColor="#f28db8" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#logo-bg)" />
      <path d="M256 176c-38-28-92-36-140-26v206c48-10 102-2 140 26z" fill="#fff" />
      <path d="M256 176c38-28 92-36 140-26v206c-48-10-102-2-140 26z" fill="#f6f2ff" />
      <path
        d="M150 206c26-4 52 0 76 10M150 244c26-4 52 0 76 10M150 282c26-4 52 0 76 10"
        stroke="#c9bffb"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M326 292c-36-22-48-40-48-58 0-14 11-25 25-25 10 0 18 5 23 13 5-8 13-13 23-13 14 0 25 11 25 25 0 18-12 36-48 58z"
        fill="#f28db8"
      />
      <path d="M378 104l7 18 18 7-18 7-7 18-7-18-18-7 18-7z" fill="#fff" />
    </svg>
  );
}
