import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
import { createTestApp } from './helpers';

describe('Contato (e2e)', () => {
  let app: INestApplication;
  const previousContact = process.env.CONTACT_EMAIL;

  beforeAll(async () => {
    process.env.CONTACT_EMAIL = 'dev@skedulei.com.br';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
    if (previousContact === undefined) delete process.env.CONTACT_EMAIL;
    else process.env.CONTACT_EMAIL = previousContact;
  });

  it('valida o corpo e repassa a mensagem ao MailService', async () => {
    const mail = app.get(MailService);
    jest.spyOn(mail, 'sendContact').mockResolvedValue(true);
    const http = request(app.getHttpServer());

    await http.post('/v1/contact').send({ name: '', email: 'nao-e-email', message: 'oi' }).expect(400);
    const res = await http
      .post('/v1/contact')
      .send({ name: 'Carlos', email: 'carlos@exemplo.com', message: 'Encontrei um problema na agenda das aulas.' })
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(mail.sendContact).toHaveBeenCalledWith(
      'dev@skedulei.com.br',
      'Carlos',
      'carlos@exemplo.com',
      'Encontrei um problema na agenda das aulas.',
    );
  });

  it('retorna 503 quando CONTACT_EMAIL não está configurado', async () => {
    delete process.env.CONTACT_EMAIL;
    await request(app.getHttpServer())
      .post('/v1/contact')
      .send({ name: 'Carlos', email: 'carlos@exemplo.com', message: 'Encontrei um problema.' })
      .expect(503);
  });
});
