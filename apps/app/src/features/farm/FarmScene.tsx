import type { CSSProperties } from 'react';
import { DEFAULT_RULES, type FarmState } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { SPECIES_EMOJI } from './farm-meta';

/** Número pseudoaleatorio estable (0–1) a partir de un texto: cada animal se mueve "a su manera". */
function seeded(text: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

type Weather = 'sunny' | 'cloudy' | 'rainy';

function weatherOf(farm: FarmState): Weather {
  if (farm.sick || farm.wellbeing < DEFAULT_RULES.sickBelow) return 'rainy';
  if (farm.wellbeing < DEFAULT_RULES.happyAbove) return 'cloudy';
  return 'sunny';
}

const SKY: Record<Weather, [string, string]> = {
  sunny: ['#7cc7f2', '#cdeefc'],
  cloudy: ['#9aa9b8', '#d3dbe2'],
  rainy: ['#55606e', '#8b96a3'],
};

/**
 * Escena de la granja dibujada con SVG. Los animales son emojis que pasean
 * por el prado; si están enfermos se ven grises y con termómetro.
 */
export function FarmScene({
  farm,
  onAnimal,
}: {
  farm: FarmState;
  onAnimal?: (id: string) => void;
}) {
  const weather = weatherOf(farm);
  const alive = farm.animals.filter((a) => a.diedOn === null);
  const [skyTop, skyBottom] = SKY[weather];
  const happy = weather === 'sunny';

  return (
    <div
      className="farm-scene relative overflow-hidden rounded-2xl border border-borde"
      role="img"
      aria-label={`Tu granja: ${alive.length} animales, bienestar ${farm.wellbeing}%`}
    >
      <svg
        viewBox="0 0 400 220"
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyBottom} />
          </linearGradient>
          <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={weather === 'rainy' ? '#5f8a4f' : '#86c46a'} />
            <stop offset="1" stopColor={weather === 'rainy' ? '#4a703e' : '#5fa04a'} />
          </linearGradient>
        </defs>
        <rect width="400" height="220" fill="url(#sky)" />

        {/* Sol o nubes */}
        {weather === 'sunny' && (
          <g className="farm-sun">
            <circle cx="340" cy="42" r="22" fill="#ffd34d" />
            <circle cx="340" cy="42" r="30" fill="#ffd34d" opacity="0.25" />
          </g>
        )}
        <g fill="#ffffff" opacity={weather === 'sunny' ? 0.85 : 0.95} className="farm-clouds">
          <ellipse cx="80" cy="40" rx="30" ry="11" />
          <ellipse cx="102" cy="34" rx="20" ry="10" />
          {weather !== 'sunny' && (
            <>
              <ellipse
                cx="230"
                cy="32"
                rx="38"
                ry="13"
                fill={weather === 'rainy' ? '#c2c9d1' : '#ffffff'}
              />
              <ellipse
                cx="258"
                cy="26"
                rx="24"
                ry="12"
                fill={weather === 'rainy' ? '#c2c9d1' : '#ffffff'}
              />
              <ellipse
                cx="330"
                cy="48"
                rx="34"
                ry="12"
                fill={weather === 'rainy' ? '#b3bbc4' : '#ffffff'}
              />
            </>
          )}
        </g>

        {/* Colinas y prado */}
        <path
          d="M0 120 Q80 92 160 112 T320 104 T400 112 V220 H0 Z"
          fill={weather === 'rainy' ? '#6c8f5c' : '#9ad07c'}
          opacity="0.8"
        />
        <path d="M0 136 Q100 118 200 132 T400 128 V220 H0 Z" fill="url(#grass)" />

        {/* Granero */}
        <g transform="translate(26 80)">
          <path d="M0 40 L36 12 L72 40 Z" fill="#8f2f22" />
          <rect x="6" y="40" width="60" height="44" fill="#c8553d" />
          <rect x="26" y="56" width="20" height="28" fill="#f3e3c3" />
          <path d="M26 56 L46 84 M46 56 L26 84" stroke="#c8553d" strokeWidth="3" />
          <rect x="30" y="24" width="12" height="10" fill="#f3e3c3" />
        </g>

        {/* Valla */}
        <g stroke="#d9b98a" strokeWidth="3" strokeLinecap="round">
          <line x1="110" y1="150" x2="400" y2="146" />
          <line x1="110" y1="162" x2="400" y2="158" />
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1={118 + i * 25}
              y1={142 - i * 0.3}
              x2={118 + i * 25}
              y2={170 - i * 0.3}
            />
          ))}
        </g>

        {/* Flores si están contentos */}
        {happy &&
          [60, 140, 210, 290, 360].map((x, i) => (
            <g key={x} transform={`translate(${x} ${196 + (i % 2) * 8})`}>
              <circle r="3" fill={i % 2 ? '#ff9ec7' : '#fff59d'} />
              <circle r="1.2" fill="#e8a33b" />
            </g>
          ))}
      </svg>

      {weather === 'rainy' && <div className="farm-rain pointer-events-none absolute inset-0" />}

      {/* Animales */}
      <div className="absolute inset-x-0 bottom-0 top-[68%]">
        {alive.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm font-medium text-white drop-shadow">
            La granja está vacía
          </p>
        )}
        {alive.map((a, i) => {
          const x = 30 + seeded(a.id, 1) * 58;
          const y = seeded(a.id, 2) * 48 + (i % 3) * 4;
          const style = {
            left: `${x}%`,
            top: `${y}%`,
            '--dx': `${(seeded(a.id, 3) > 0.5 ? 1 : -1) * (18 + seeded(a.id, 4) * 40)}px`,
            animationDuration: `${(farm.sick ? 16 : 9) + seeded(a.id, 5) * 8}s`,
            animationDelay: `-${seeded(a.id, 6) * 10}s`,
            zIndex: Math.round(y),
          } as CSSProperties;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onAnimal?.(a.id)}
              title={a.name}
              aria-label={a.name}
              className={cx(
                'farm-animal absolute -translate-x-1/2 text-[clamp(28px,6vw,44px)] leading-none',
                farm.sick && 'farm-animal--sick',
              )}
              style={style}
            >
              <span className="farm-animal__body inline-block">{SPECIES_EMOJI[a.species]}</span>
              {farm.sick && <span className="absolute -top-2 -right-2 text-xs">🤒</span>}
              {happy && seeded(a.id, 7) > 0.7 && (
                <span className="farm-heart absolute -top-3 left-1/2 text-[10px]">❤️</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="absolute top-2 left-2 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        Nivel {farm.level}
      </div>
    </div>
  );
}
