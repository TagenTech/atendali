import { deviceLabel, isMfaChallenge } from './auth';

describe('auth helpers', () => {
  it('deviceLabel', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120')).toBe('Windows · Edge');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(deviceLabel(undefined)).toBe('Aparelho');
  });
  it('isMfaChallenge', () => {
    expect(isMfaChallenge({ mfaRequired: true, mfaToken: 'x' })).toBe(true);
  });
});
