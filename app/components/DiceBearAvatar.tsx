import React, { useState } from 'react';
import Image from 'next/image';
import InitialAvatar from './InitialAvatar';

interface DiceBearAvatarProps {
  name: string;
  size?: number;
  className?: string;
  style?: 'adventurer' | 'avataaars' | 'bottts' | 'identicon' | 'lorelei';
}

export default function DiceBearAvatar({
  name,
  size = 48,
  className = '',
  style = 'lorelei',
}: DiceBearAvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <InitialAvatar name={name} size={size} className={className} />;
  }

  const seed = encodeURIComponent(name);
  const src = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;

  return (
    <Image
      src={src}
      alt={`Avatar ${name}`}
      width={size}
      height={size}
      className={`object-cover ${className}`}
      onError={() => setHasError(true)}
    />
  );
}
