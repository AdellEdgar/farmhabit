import { Star } from 'lucide-react';

/** Nota de media en media estrella. Pulsar la nota que ya tiene la quita. */
export function RatingStars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Nota">
      {stars.map((n) => {
        const fill = value === null ? 0 : Math.min(1, Math.max(0, value - n + 1));
        return (
          <span key={n} className="relative block size-8">
            <Star size={32} className="absolute inset-0 text-borde" />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={32} className="fill-grano text-grano" />
            </span>
            {[n - 0.5, n].map((rating, i) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(value === rating ? null : rating)}
                aria-label={`${String(rating).replace('.', ',')} estrellas`}
                aria-pressed={value === rating}
                className={`absolute inset-y-0 w-1/2 ${i === 0 ? 'left-0' : 'right-0'}`}
              />
            ))}
          </span>
        );
      })}
      {value !== null && (
        <span className="ml-1 text-sm text-texto-suave tabular-nums">
          {String(value).replace('.', ',')}
        </span>
      )}
    </div>
  );
}
