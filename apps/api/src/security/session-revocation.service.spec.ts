import type { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import { SessionRevocationService } from './session-revocation.service';

describe('SessionRevocationService', () => {
  let validAfter: Date | null;
  let svc: SessionRevocationService;

  beforeEach(() => {
    validAfter = null;
    const repo = {
      findOne: jest.fn(async () => ({ id: 't1', tokensValidAfter: validAfter })),
      update: jest.fn(async (_id: string, p: { tokensValidAfter: Date }) => {
        validAfter = p.tokensValidAfter;
      }),
    } as unknown as Repository<User>;
    svc = new SessionRevocationService(repo);
  });

  it('token emitido antes do corte é recusado; depois, aceito', async () => {
    const before = Math.floor(Date.now() / 1000) - 60;
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: before })).toBe(false);
    await svc.revokeAllFor('t1');
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: before })).toBe(true);
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: Math.floor(Date.now() / 1000) + 1 })).toBe(false);
  });

  it('sessão encerrada derruba o access token dela', async () => {
    const p = { sub: 't1', email: 'x', sid: 's1', iat: Math.floor(Date.now() / 1000) };
    expect(await svc.isRevoked(p)).toBe(false);
    svc.revokeSession('s1');
    expect(await svc.isRevoked(p)).toBe(true);
    expect(await svc.isRevoked({ ...p, sid: 's2' })).toBe(false);
  });
});
