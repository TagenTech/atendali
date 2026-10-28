import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { isIsoDate, isValidPhone, normalizePhone } from '@skedulei/contracts';

/** '' e espaços viram null — o formulário manda campo vazio para "apagar". */
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/** Aceita qualquer máscara: guarda só os dígitos (Brasil) ou E.164 com "+" (outros países). */
export function IsPhone(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    Transform(({ value }) =>
      typeof value === 'string' ? (value.trim() ? normalizePhone(value) : null) : value,
    )(target, propertyName);
    registerDecorator({
      name: 'isPhone',
      target: target.constructor,
      propertyName,
      options: { message: 'Telefone inválido — use DDD + número, ou + e o código do país', ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && isValidPhone(v) },
    });
  };
}

export function IsIsoDate(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isIsoDate',
      target: target.constructor,
      propertyName,
      options: { message: 'Data inválida', ...options },
      validator: { validate: (v: unknown) => isIsoDate(v) },
    });
  };
}
