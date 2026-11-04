import { useState } from 'react';
import { fnv1a, isAllowedCover } from '@farmhabit/core';
import { cx } from '../../lib/cx';

/** Portada del libro. Sin enlace válido o sin internet, una de color con el título. */
export function BookCover({
  title,
  coverUrl,
  className,
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cx('aspect-[2/3] shrink-0 overflow-hidden rounded-lg shadow-sm', className);

  if (isAllowedCover(coverUrl) && !failed) {
    return (
      <img
        src={coverUrl!}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cx(base, 'bg-elevado object-cover')}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cx(base, 'flex items-center p-1.5 text-center font-semibold text-white')}
      style={{ background: `hsl(${fnv1a(title) % 360} 40% 38%)` }}
    >
      <span className="line-clamp-5 w-full text-[10px] leading-tight">{title}</span>
    </div>
  );
}
