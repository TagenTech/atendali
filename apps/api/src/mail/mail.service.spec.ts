import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

describe('MailService', () => {
  const env = { ...process.env };
  let svc: MailService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    svc = new MailService();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  describe('sem chave do Resend', () => {
    beforeEach(() => delete process.env.RESEND_API_KEY);

    it('em desenvolvimento guarda na caixa de saída (no máximo 30) e não envia', async () => {
      expect(svc.enabled).toBe(false);
      for (let i = 0; i < 32; i++) await svc.send({ to: `p${i}@x.com`, subject: `Assunto ${i}`, html: '<p/>', link: i === 31 ? 'https://x/y' : undefined });
      const recent = svc.recent();
      expect(recent).toHaveLength(30);
      expect(recent[0].to).toBe('p31@x.com');
      expect(Logger.prototype.warn).toHaveBeenLastCalledWith(expect.stringContaining('Link: https://x/y'));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('em produção só registra o erro: o link (token) nunca vai para o log nem para a memória', async () => {
      process.env.NODE_ENV = 'production';
      expect(await svc.send({ to: 'a@x.com', subject: 'Oi', html: '<p/>', link: 'https://segredo' })).toBe(false);
      expect(svc.recent()).toEqual([]);
      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY ausente'));
    });
  });

  describe('com chave', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test';
    });

    it('envia pelo Resend com remetente padrão e responder-para quando houver', async () => {
      delete process.env.MAIL_FROM;
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      expect(await svc.sendContact('dono@x.com', 'Ana [ok]', 'ana@x.com', 'Olá <b>')).toBe(true);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.resend.com/emails');
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ from: 'Skedulei <onboarding@resend.dev>', to: 'dono@x.com', reply_to: 'ana@x.com', subject: '[Skedulei] Contato de Ana  ok ' });
      expect(body.html).not.toContain('<b>');
    });

    it('usa o MAIL_FROM configurado e omite o responder-para', async () => {
      process.env.MAIL_FROM = 'Clínica <oi@clinica.com>';
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      await svc.sendPasswordReset('a@x.com', 'https://x/reset');
      const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
      expect(body.from).toBe('Clínica <oi@clinica.com>');
      expect(body).not.toHaveProperty('reply_to');
    });

    it('resposta de erro ou queda de rede devolvem false sem lançar', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'domínio não verificado' } as Response);
      expect(await svc.send({ to: 'a@x.com', subject: 'Oi', html: '<p/>' })).toBe(false);
      expect(Logger.prototype.error).toHaveBeenLastCalledWith(expect.stringContaining('422 domínio não verificado'));
      fetchSpy.mockRejectedValueOnce(new Error('timeout'));
      expect(await svc.send({ to: 'a@x.com', subject: 'Oi', html: '<p/>' })).toBe(false);
    });

    it('lembrete: título muda com a antecedência e o endereço é opcional', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const base = { patientName: 'Ana Souza', orgName: 'Studio <X>', serviceName: 'Corte', professionalName: 'Paula', when: 'amanhã às 10h', url: 'https://x/r' };
      await svc.sendReminder('a@x.com', { ...base, address: null, kind: 'H24' });
      await svc.sendReminder('a@x.com', { ...base, address: 'Rua A, 1', kind: 'H2' });
      const [h24, h2] = fetchSpy.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));
      expect(h24.subject).toMatch(/^Lembrete: amanhã/);
      expect(h2.subject).toMatch(/^Daqui a pouco/);
      expect(h24.html).not.toContain('Rua A');
      expect(h2.html).toContain('Rua A, 1');
      expect(h24.html).not.toContain('<X>');
    });
  });
});
