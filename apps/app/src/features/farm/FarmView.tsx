import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { DEFAULT_RULES, type FarmAnimal } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatRelativeDate } from '../../lib/format';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
} from '../../components/ui';
import { FarmSummary } from './FarmSummary';
import { SPECIES_EMOJI, SPECIES_NAME } from './farm-meta';

export function FarmView() {
  const { data, farm, today, mutate } = useApp();
  const [firstName, setFirstName] = useState('');
  const [renaming, setRenaming] = useState<FarmAnimal | null>(null);
  const [newName, setNewName] = useState('');

  const alive = farm.animals.filter((a) => a.diedOn === null);
  const dead = farm.animals.filter((a) => a.diedOn !== null);
  const lastDays = farm.days.slice(-7).reverse();

  const adopt = () =>
    mutate((db) =>
      db.repo('animals').create({
        name: firstName.trim() || 'Lola',
        species: 'chicken',
        acquiredOn: today,
        source: 'starter',
        price: 0,
      }),
    );

  const rename = async () => {
    if (!renaming || !newName.trim()) return;
    const existing = data.animals.find((a) => a.id === renaming.id);
    await mutate((db) =>
      existing
        ? db.repo('animals').update(existing.id, { name: newName.trim() })
        : db.repo('animals').put(renaming.id, {
            name: newName.trim(),
            species: renaming.species,
            acquiredOn: renaming.acquiredOn,
            source: 'born',
            price: 0,
          }),
    );
    setRenaming(null);
  };

  return (
    <>
      <PageHeader
        title="Granja"
        subtitle="La granja completa con animales, tienda y logros llegará en la Fase 6."
      />

      {farm.animals.length === 0 ? (
        <Card className="mb-5">
          <EmptyState icon="🐣" title="Adopta tu primer animal">
            <p>
              Ponle nombre a tu primera gallina. Si cuidas tus hábitos, la granja crecerá; si no…
              enfermará.
            </p>
            <form
              className="mx-auto mt-4 flex max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void adopt();
              }}
            >
              <Input
                placeholder="Nombre (p. ej. Lola)"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-label="Nombre del animal"
              />
              <Button variant="primary" type="submit">
                Adoptar
              </Button>
            </form>
          </EmptyState>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FarmSummary farm={farm} />

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Últimos días</h2>
          {lastDays.length === 0 ? (
            <p className="text-sm text-texto-suave">Aún no hay días cerrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lastDays.map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-2">
                  <span className="w-24 text-texto-suave">{formatRelativeDate(d.date, today)}</span>
                  <span className="flex-1 text-xs text-texto-suave">
                    {d.vacation
                      ? '🏖️ Vacaciones'
                      : d.compliance === null
                        ? 'Sin hábitos que cuenten'
                        : `${Math.round(d.compliance * 100)}% cumplido`}
                    {d.events.some((e) => e.type === 'death') && ' · 💀'}
                    {d.events.some((e) => e.type === 'birth') && ' · 🐣'}
                  </span>
                  <span
                    className={
                      d.wellbeingDelta > 0
                        ? 'text-acento'
                        : d.wellbeingDelta < 0
                          ? 'text-peligro'
                          : 'text-texto-suave'
                    }
                  >
                    {d.wellbeingDelta > 0 ? '+' : ''}
                    {d.wellbeingDelta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {alive.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 font-semibold">
            Tus animales{' '}
            <span className="text-sm font-normal text-texto-suave">
              {alive.length} / {DEFAULT_RULES.capacity(farm.level)}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {alive.map((a) => (
              <Card key={a.id} className="flex items-center gap-3 p-3">
                <span className={`text-3xl ${farm.sick ? 'grayscale' : ''}`} aria-hidden="true">
                  {SPECIES_EMOJI[a.species]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-texto-suave">
                    {SPECIES_NAME[a.species]} · {a.source === 'born' ? 'nació' : 'llegó'}{' '}
                    {formatRelativeDate(a.acquiredOn, today).toLowerCase()}
                  </p>
                </div>
                <IconButton
                  label={`Cambiar el nombre de ${a.name}`}
                  onClick={() => {
                    setRenaming(a);
                    setNewName(a.name);
                  }}
                >
                  <Pencil size={15} />
                </IconButton>
              </Card>
            ))}
          </div>
        </section>
      )}

      {dead.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 font-semibold">🪦 Cementerio</h2>
          <Card className="divide-y divide-borde">
            {dead.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="grayscale" aria-hidden="true">
                  {SPECIES_EMOJI[a.species]}
                </span>
                <span className="flex-1 font-medium">{a.name}</span>
                <span className="text-xs text-texto-suave">
                  {a.acquiredOn} – {a.diedOn}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Cambiar nombre"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={rename} disabled={!newName.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={newName}
          maxLength={50}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void rename()}
          aria-label="Nuevo nombre"
        />
      </Dialog>
    </>
  );
}
