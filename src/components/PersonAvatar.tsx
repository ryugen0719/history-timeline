import { useEffect, useState } from 'react';

interface PersonAvatarProps {
  name: string;
  photoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<PersonAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
};

function getInitialLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1);
}

export function PersonAvatar({
  name,
  photoUrl,
  size = 'sm',
}: PersonAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  const sizeClass = SIZE_CLASSES[size];

  if (photoUrl && !hasError) {
    return (
      <img
        src={photoUrl}
        alt={`${name}の顔写真`}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`${sizeClass} rounded-md object-cover object-top border border-[#D6CEBE] bg-[#F4F0E8] shrink-0`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} rounded-md border border-[#D6CEBE] bg-[#F4F0E8] text-[#57534E] font-serif font-semibold inline-flex items-center justify-center shrink-0 select-none`}
    >
      {getInitialLabel(name)}
    </span>
  );
}
