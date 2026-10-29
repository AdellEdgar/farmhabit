import { useState } from 'react';
import { Lock, Wheat } from 'lucide-react';
import { aliveCount, buyAnimal, DEFAULT_RULES, shopOffers, type ShopOffer } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { useApp } from '../../lib/use-app';
import { Button, Card, Dialog, Input } from '../../components/ui';
import { SPECIES_EMOJI, SPECIES_NAME } from './farm-meta';

export function FarmShop() {
  const { farm, mutate, toast } = useApp();
  const [buying, setBuying] = useState<ShopOffer | null>(null);
  const [name, setName] = useState('');
  const capacity = DEFAULT_RULES.capacity(farm.level);
  const full = aliveCount(farm) >= capacity;

  const buy = async () => {
    if (!buying || !name.trim()) return;
    const animal = await mutate((db) => buyAnimal(db, farm, buying.species, name));
    if (animal) {
      toast(`¡Bienvenido/a, ${animal.name}! ${SPECIES_EMOJI[animal.species]}`);
      setBuying(null);
      setName('');
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-lg font-semibold text-grano">
          <Wheat size={20} /> {farm.grain} de grano
        </p>
        <p className={cx('text-sm', full ? 'text-aviso' : 'text-texto-suave')}>
          {aliveCount(farm)} / {capacity} animales {full && '· sube de nivel para tener más sitio'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shopOffers(farm).map((o) => {
          const canBuy = o.unlocked && o.affordable && !full;
          return (
            <Card
              key={o.species}
              className={cx(
                'flex flex-col items-center p-4 text-center',
                !o.unlocked && 'opacity-60',
              )}
            >
              <span className={cx('text-5xl', !o.unlocked && 'grayscale')} aria-hidden="true">
                {SPECIES_EMOJI[o.species]}
              </span>
              <p className="mt-2 font-semibold">{SPECIES_NAME[o.species]}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-grano">
                <Wheat size={14} /> {o.price}
              </p>
              {o.unlocked ? (
                <Button
                  variant={canBuy ? 'primary' : 'secondary'}
                  disabled={!canBuy}
                  onClick={() => setBuying(o)}
                  className="mt-3 w-full"
                >
                  {o.affordable ? 'Comprar' : 'Falta grano'}
                </Button>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-texto-suave">
                  <Lock size={12} /> Nivel {o.unlockLevel}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-texto-suave">
        El grano se gana cumpliendo hábitos y se pierde al fallarlos. Cuando tus animales están
        contentos una semana seguida, nacen crías gratis.
      </p>

      <Dialog
        open={buying !== null}
        onOpenChange={(o) => !o && setBuying(null)}
        title={buying ? `Comprar ${SPECIES_NAME[buying.species]?.toLowerCase()}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBuying(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={buy} disabled={!name.trim()}>
              Comprar por {buying?.price} de grano
            </Button>
          </>
        }
      >
        <div className="text-center text-6xl" aria-hidden="true">
          {buying && SPECIES_EMOJI[buying.species]}
        </div>
        <Input
          autoFocus
          placeholder="¿Cómo se va a llamar?"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void buy()}
          aria-label="Nombre del animal"
        />
      </Dialog>
    </>
  );
}
