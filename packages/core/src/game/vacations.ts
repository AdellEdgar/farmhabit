import type { Vacation } from '../model/types';
import type { LocalDate } from '../util/dates';
import { localDateOf } from '../util/dates';

/** ¿Está `date` protegido por unas vacaciones? Solo cuentan las creadas ANTES de ese día. */
export function isVacationDay(vacations: Vacation[], date: LocalDate): boolean {
  return vacations.some(
    (v) =>
      v.deletedAt === null &&
      v.startDate <= date &&
      date <= v.endDate &&
      localDateOf(v.createdAt) < date,
  );
}
