import { ReactNode } from 'react';

type Color = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  color?: Color;
  children: ReactNode;
}

const COLOR_CLASSES: Record<Color, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export default function Badge({ color = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
