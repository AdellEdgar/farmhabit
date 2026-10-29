import { describe, expect, it } from 'vitest';
import { expandEvents, IcsParseError, parseIcs } from '../src/domain/ics';
import { localDateTimeToEpoch } from '../src/util/dates';

// Los tests corren en Europe/Madrid (ver vitest.config.ts). En 2026 el cambio
// a horario de invierno es el domingo 25 de octubre.

const at = (date: string, time: string) => localDateTimeToEpoch(date, time);
const cal = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//ES', ...lines, 'END:VCALENDAR'].join('\r\n');
const ALL = { from: at('2026-01-01', '00:00'), to: at('2027-12-31', '23:59') };
const expandAll = (text: string) => expandEvents(parseIcs(text), ALL.from, ALL.to);

describe('lectura de .ics', () => {
  it('lee un evento con zona horaria', () => {
    const [o] = expandAll(
      cal(
        'BEGIN:VEVENT',
        'UID:clase-1',
        'SUMMARY:Redes de computadores',
        'LOCATION:Aula TD1201',
        'DTSTART;TZID=Europe/Madrid:20261026T100000',
        'DTEND;TZID=Europe/Madrid:20261026T113000',
        'END:VEVENT',
      ),
    );
    expect(o).toMatchObject({
      title: 'Redes de computadores',
      location: 'Aula TD1201',
      allDay: false,
      start: at('2026-10-26', '10:00'),
      end: at('2026-10-26', '11:30'),
      startDate: '2026-10-26',
    });
  });

  it('convierte horas en UTC y zonas de Windows (Outlook)', () => {
    const [utc, windows] = expandAll(
      cal(
        'BEGIN:VEVENT',
        'UID:a',
        'SUMMARY:UTC',
        'DTSTART:20261026T090000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:b',
        'SUMMARY:Outlook',
        'DTSTART;TZID=Romance Standard Time:20261027T090000',
        'DURATION:PT1H',
        'END:VEVENT',
      ),
    );
    expect(utc!.start).toBe(at('2026-10-26', '10:00'));
    expect(windows!.start).toBe(at('2026-10-27', '09:00'));
    expect(windows!.end).toBe(at('2026-10-27', '10:00'));
  });

  it('eventos de día completo', () => {
    const [o] = expandAll(
      cal(
        'BEGIN:VEVENT',
        'UID:fiesta',
        'SUMMARY:Fiesta',
        'DTSTART;VALUE=DATE:20261012',
        'DTEND;VALUE=DATE:20261013',
        'END:VEVENT',
      ),
    );
    expect(o).toMatchObject({ allDay: true, startDate: '2026-10-12', endDate: '2026-10-12' });
  });

  it('une líneas partidas y quita los escapes', () => {
    const text = cal(
      'BEGIN:VEVENT',
      'UID:x',
      'SUMMARY:Examen de Re',
      ' des\\, aula 3',
      'DESCRIPTION:Primera línea\\nSegunda; con \\; punto y coma',
      'DTSTART:20261110T080000Z',
      'END:VEVENT',
    );
    const [o] = expandAll(text);
    expect(o!.title).toBe('Examen de Redes, aula 3');
    expect(o!.description).toBe('Primera línea\nSegunda; con ; punto y coma');
  });

  it('ignora lo que hay dentro de las alarmas (VALARM)', () => {
    const [o] = expandAll(
      cal(
        'BEGIN:VEVENT',
        'UID:x',
        'SUMMARY:Tutoría',
        'DTSTART:20261110T080000Z',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Recordatorio',
        'TRIGGER:-PT15M',
        'END:VALARM',
        'END:VEVENT',
      ),
    );
    expect(o).toMatchObject({ title: 'Tutoría', description: '' });
  });

  it('no muestra eventos cancelados', () => {
    expect(
      expandAll(
        cal(
          'BEGIN:VEVENT',
          'UID:x',
          'SUMMARY:No',
          'STATUS:CANCELLED',
          'DTSTART:20261110T080000Z',
          'END:VEVENT',
        ),
      ),
    ).toEqual([]);
  });

  it('rechaza lo que no es un calendario', () => {
    expect(() => parseIcs('<html>Inicia sesión</html>')).toThrow(IcsParseError);
  });
});

describe('repeticiones', () => {
  const weekly = [
    'BEGIN:VEVENT',
    'UID:teoria',
    'SUMMARY:Teoría',
    'DTSTART;TZID=Europe/Madrid:20261019T090000',
    'DTEND;TZID=Europe/Madrid:20261019T110000',
    'RRULE:FREQ=WEEKLY;COUNT=4',
  ];

  it('mantienen la hora local al cruzar el cambio de hora', () => {
    const list = expandAll(cal(...weekly, 'END:VEVENT'));
    expect(list.map((o) => o.start)).toEqual([
      at('2026-10-19', '09:00'),
      at('2026-10-26', '09:00'),
      at('2026-11-02', '09:00'),
      at('2026-11-09', '09:00'),
    ]);
  });

  it('respetan EXDATE, ocurrencias movidas y canceladas', () => {
    const list = expandAll(
      cal(
        ...weekly,
        'EXDATE;TZID=Europe/Madrid:20261026T090000',
        'END:VEVENT',
        // La del 2 de noviembre se mueve a las 12:00.
        'BEGIN:VEVENT',
        'UID:teoria',
        'RECURRENCE-ID;TZID=Europe/Madrid:20261102T090000',
        'SUMMARY:Teoría (cambio de hora)',
        'DTSTART;TZID=Europe/Madrid:20261102T120000',
        'DTEND;TZID=Europe/Madrid:20261102T140000',
        'END:VEVENT',
        // La del 9 de noviembre se cancela.
        'BEGIN:VEVENT',
        'UID:teoria',
        'RECURRENCE-ID;TZID=Europe/Madrid:20261109T090000',
        'STATUS:CANCELLED',
        'DTSTART;TZID=Europe/Madrid:20261109T090000',
        'END:VEVENT',
      ),
    );
    expect(list.map((o) => [o.startDate, o.title])).toEqual([
      ['2026-10-19', 'Teoría'],
      ['2026-11-02', 'Teoría (cambio de hora)'],
    ]);
    expect(list[1]!.start).toBe(at('2026-11-02', '12:00'));
  });

  it('solo devuelve lo que cae en el rango pedido', () => {
    const text = cal(
      'BEGIN:VEVENT',
      'UID:d',
      'SUMMARY:Diario',
      'DTSTART;TZID=Europe/Madrid:20260101T080000',
      'DURATION:PT30M',
      'RRULE:FREQ=DAILY',
      'END:VEVENT',
    );
    const list = expandEvents(parseIcs(text), at('2026-10-24', '00:00'), at('2026-10-26', '23:59'));
    expect(list.map((o) => o.startDate)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('las de día completo con EXDATE por fecha', () => {
    const list = expandAll(
      cal(
        'BEGIN:VEVENT',
        'UID:g',
        'SUMMARY:Gimnasio',
        'DTSTART;VALUE=DATE:20261005',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'EXDATE;VALUE=DATE:20261012',
        'END:VEVENT',
      ),
    );
    expect(list.map((o) => o.startDate)).toEqual(['2026-10-05', '2026-10-19']);
  });
});
