import { useState } from 'react';
import { Shield } from 'lucide-react';
import {
  AURAS,
  BACKGROUNDS,
  buyItem,
  DEFAULT_CREATURE_RULES as RULES,
  itemPrice,
  type SpeciesId,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button, Card } from '../../components/ui';
import { backgroundUrl } from './assets';
import { AURA_NAMES, BACKGROUND_NAMES } from './creature-meta';
import { CreatureImage } from './CreatureImage';

/** Pestaña Tienda: comodines, fondos y auras. */
export function ShopTab() {
  const { game, mutate, today } = useApp();
  const preview: SpeciesId = game.creatures[0]?.species ?? 'panda';

  /** Motivo por el que no se puede comprar (null si se puede). */
  const blocked = (item: string): string | null => {
    const price = itemPrice(item)!;
    if (item === 'freeze' && game.freezes >= RULES.freezeMax) return 'Ya tienes el máximo';
    if (item !== 'freeze' && game.owned.includes(item)) return 'Comprado';
    if (game.pesetas < price) return `Te faltan ${price - game.pesetas}`;
    return null;
  };
  // Sin doble clic: el saldo no se actualiza hasta que termina la compra.
  const [buying, setBuying] = useState(false);
  const buy = async (item: string) => {
    setBuying(true);
    await mutate((db) => buyItem(db, item, game, today));
    setBuying(false);
  };

  const buyButton = (item: string) => {
    const reason = blocked(item);
    return (
      <Button
        variant={reason ? 'secondary' : 'primary'}
        disabled={reason !== null || buying}
        onClick={() => void buy(item)}
        className="w-full"
      >
        {reason ?? `Comprar · ${itemPrice(item)}`}
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-suave">
        Tienes <b className="text-grano">{game.pesetas} pesetas</b>. Se ganan haciendo hábitos,
        completando tareas y con los logros.
      </p>

      <section>
        <h2 className="mb-2 font-semibold">Comodín</h2>
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <Shield size={36} className="shrink-0 text-info" />
          <p className="min-w-48 flex-1 text-sm text-texto-suave">
            Se gasta solo: si un día se cierra con hábitos sin hacer, ese día no cuenta para nadie
            (ni quita XP ni rompe rachas). Puedes guardar {RULES.freezeMax}; ahora tienes{' '}
            {game.freezes}.
          </p>
          <div className="w-full sm:w-56">{buyButton('freeze')}</div>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Fondos</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {BACKGROUNDS.map((id) => {
            const url = backgroundUrl(id);
            return (
              <Card key={id} className="overflow-hidden">
                <div
                  className="grid aspect-square place-items-center bg-elevado bg-cover bg-center"
                  style={url ? { backgroundImage: `url(${url})` } : undefined}
                >
                  {!url && <span className="text-sm text-texto-suave">{BACKGROUND_NAMES[id]}</span>}
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-medium">{BACKGROUND_NAMES[id]}</p>
                  {buyButton(`background:${id}`)}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Auras</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {AURAS.map((id) => (
            <Card key={id} className="overflow-hidden">
              <div className="grid aspect-square place-items-center bg-elevado">
                <CreatureImage species={preview} stage={2} px={96} aura={id} />
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-medium">{AURA_NAMES[id]}</p>
                {buyButton(`aura:${id}`)}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
