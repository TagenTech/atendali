import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SecurityEvent } from './entities/security-event.entity';
import { maskIp, SecurityEventsService } from './security-events.service';

describe('maskIp', () => {
  it('esconde o fim do IP e reconhece o próprio computador', () => {
    expect(maskIp(null)).toBeNull();
    expect(maskIp('::1')).toBe('local');
    expect(maskIp('127.0.0.1')).toBe('local');
    expect(maskIp('::ffff:127.0.0.1')).toBe('local');
    expect(maskIp('189.12.34.56')).toBe('189.12.x.x');
    expect(maskIp('::ffff:200.1.2.3')).toBe('200.1.x.x');
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:…');
  });
});

describe('SecurityEventsService', () => {
  const make = (overrides: Partial<Record<'save' | 'find' | 'delete', jest.Mock>> = {}) => {
    const repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      find: jest.fn(async () => []),
      delete: jest.fn(async () => undefined),
      ...overrides,
    };
    return { repo, svc: new SecurityEventsService(repo as unknown as Repository<SecurityEvent>) };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('grava com ou sem contexto e avisa no log só os eventos graves', async () => {
    const { repo, svc } = make();
    await svc.record('LOGIN_OK', 'u1', { ip: '1.2.3.4', userAgent: 'Mozilla' }, { a: 1 });
    expect(repo.save).toHaveBeenCalledWith({ type: 'LOGIN_OK', userId: 'u1', ip: '1.2.3.4', userAgent: 'Mozilla', meta: { a: 1 } });
    await svc.record('LOGIN_LOCKED', null);
    expect(repo.save).toHaveBeenLastCalledWith({ type: 'LOGIN_LOCKED', userId: null, ip: null, userAgent: null, meta: null });
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    await svc.record('LOGIN_LOCKED', 'u2', { ip: '9.9.9.9' });
    expect(Logger.prototype.warn).toHaveBeenLastCalledWith(expect.stringContaining('ip=9.9.9.9'));
  });

  it('falha ao gravar não derruba a requisição', async () => {
    const { svc } = make({ save: jest.fn(async () => Promise.reject(new Error('banco fora'))) });
    await expect(svc.record('LOGIN_OK', 'u1')).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('banco fora'));
  });

  it('lista com aparelho e IP mascarado; limpeza apaga o que passou de 1 ano', async () => {
    const { repo, svc } = make({ find: jest.fn(async () => [{ id: 'e1', type: 'LOGIN_OK', userAgent: null, ip: '10.20.30.40', createdAt: new Date('2026-01-01T00:00:00Z') }]) });
    const [e] = await svc.list('u1');
    expect(e).toMatchObject({ id: 'e1', ip: '10.20.x.x', createdAt: '2026-01-01T00:00:00.000Z' });
    await svc.prune();
    expect(repo.delete).toHaveBeenCalledTimes(1);
  });
});
