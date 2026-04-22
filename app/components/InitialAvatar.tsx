import React from 'react';

interface InitialAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const s = 60 + (Math.abs(hash) % 20);
  const l = 45 + (Math.abs(hash) % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InitialAvatar({ name, size = 48, className = '' }: InitialAvatarProps) {
  const bgColor = stringToColor(name);
  const initials = getInitials(name);
  const fontSize = Math.floor(size * 0.42);

  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        color: '#ffffff',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.05em',
        lineHeight: 1,
      }}
      aria-label={`Avatar ${name}`}
      role="img"
    >
      {initials}
    </div>
  );
}
