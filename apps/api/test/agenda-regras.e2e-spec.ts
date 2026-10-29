/**
 * Agenda, clientes, reserva online e lista de espera: caminhos de edição e de recusa
 * (complementa `agenda`, `carrinho` e `responsavel-reservas`). Banco skedulei_test.
 */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, defaultBusinessHours, ORG_HEADER, todayIn, weekdayOf, zonedToUtc } from '@skedulei/contracts';
import { Appointment } from '../src/agenda/entities/appointment.entity';
import { signReminderLink } from '../src/agenda/reminder-link';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;
const TZ = 'America/Sao_Paulo';
function nextTuesday(): string {
  let d = addDays(todayIn(TZ), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}
const DAY = nextTuesday();
const at = (time: string, date = DAY) => zonedToUtc(date, time, TZ).toISOString();
const NOPE = '00000000-0000-0000-0000-000000000000';

describe('Agenda e reserva: regras e recusas (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let paula: Session;
  let orgId = '';
  let slug = '';
  let corte = '';
  let barba = '';
  let ids: Record<string, string> = {};
  const inOrg = (s: Session) => ({ ...s.auth, [ORG_HEADER]: orgId });
  const staff = (path: string, s: Session = dona) => ({
    get: () => http.get(`/v1/org/${path}`).set(inOrg(s)),
    post: (b: object = {}) => http.post(`/v1/org/${path}`).set(inOrg(s)).send(b),
    patch: (b: object) => http.patch(`/v1/org/${path}`).set(inOrg(s)).send(b),
    del: () => http.delete(`/v1/org/${path}`).set(inOrg(s)),
  });
  const appt = (extra: Record<string, unknown>, s: Session = dona) =>
    staff('appointments', s).post({ memberId: ids['Dona Regras'], serviceId: corte, ...extra });
  const pub = (path: string) => `/v1/public/${path}`;
  const book = (body: Record<string, unknown>) => http.post(pub(`orgs/${slug}/bookings`)).send({ serviceId: corte, ...body });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dona Regras', 'dona-regras@skedulei.test');
    const created = await http
      .post('/v1/organizations')
      .set(dona.auth)
      .send(
        newOrg('Salão Regras', {
          unit: { name: 'Matriz', street: 'Rua das Flores', number: '10', district: 'Centro', city: 'São Paulo', state: 'sp', businessHours: defaultBusinessHours() },
          services: [
            { name: 'Corte', category: 'Cabelo', durationMinutes: 40, priceCents: 5000 },
            { name: 'Barba', category: 'Barba', durationMinutes: 20, priceCents: 3000 },
          ],
          team: [
            { name: 'Paula Pro', email: 'paula-regras@skedulei.test', role: 'PROFISSIONAL', bookable: true },
            { name: 'Rita Recepção', email: 'rita-regras@skedulei.test', role: 'RECEPCAO', bookable: false },
          ],
        }),
      )
      .expect(201);
    orgId = created.body.id;
    slug = created.body.slug;
    const services = (await staff('services').get().expect(200)).body as { id: string; name: string }[];
    corte = services.find((s) => s.name === 'Corte')!.id;
    barba = services.find((s) => s.name === 'Barba')!.id;
    const members = (await staff('members').get().expect(200)).body as { id: string; name: string }[];
    ids = Object.fromEntries(members.map((m) => [m.name, m.id]));
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === 'paula-regras@skedulei.test' && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    paula = await registerUser(http, 'Paula', 'paula-regras@skedulei.test');
    await http.post('/v1/invites/accept').set(paula.auth).send({ token }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('clientes', () => {
    let id = '';
    it('cadastro com responsável e edição campo a campo', async () => {
      const novo = (
        await staff('clients').post({ name: 'Lia Pequena', phone: '11911112222', email: 'lia@x.test', birthDate: '2020-01-10', guardianName: 'Mãe da Lia', guardianRelationship: 'MAE', notes: 'Alergia', tags: ['a', 'b'] }).expect(201)
      ).body;
      id = novo.id;
      expect(novo).toMatchObject({ guardianName: 'Mãe da Lia', guardianRelationship: 'MAE', birthDate: '2020-01-10', notes: 'Alergia' });
      // Sem responsável não guarda parentesco.
      const solta = (await staff('clients').post({ name: 'Solta', guardianRelationship: 'MAE' }).expect(201)).body;
      expect(solta.guardianRelationship).toBeNull();

      const editado = (
        await staff(`clients/${id}`).patch({ name: 'Lia Grande', phone: '11933334444', email: 'lia2@x.test', birthDate: '2019-02-02', guardianName: 'Pai da Lia', guardianRelationship: 'PAI', notes: 'Sem alergias', tags: ['x', ' x ', ''] }).expect(200)
      ).body;
      expect(editado).toMatchObject({ name: 'Lia Grande', phone: '11933334444', email: 'lia2@x.test', birthDate: '2019-02-02', guardianName: 'Pai da Lia', guardianRelationship: 'PAI', notes: 'Sem alergias', tags: ['x'] });
      // Tirar o responsável apaga o parentesco; limpar as observações também.
      const limpo = (await staff(`clients/${id}`).patch({ guardianName: null, notes: null }).expect(200)).body;
      expect(limpo).toMatchObject({ guardianName: null, guardianRelationship: null, notes: null });
      await staff(`clients/${NOPE}`).patch({ name: 'x' }).expect(404);
    });

    it('busca por telefone e por nome; ficha mostra quem divide o telefone; excluído some', async () => {
      await staff('clients').post({ name: 'Irmão da Lia', phone: '11933334444' }).expect(201);
      expect((await staff('clients?q=3333').get().expect(200)).body).toHaveLength(2);
      expect((await staff('clients?q=ab').get().expect(200)).body).toEqual([]);
      const ficha = (await staff(`clients/${id}`).get().expect(200)).body;
      expect(ficha.relatives.map((r: { name: string }) => r.name)).toEqual(['Irmão da Lia']);
      expect(ficha.stats).toMatchObject({ total: 0, noShows: 0, spentCents: 0, lastVisit: null });
      await staff(`clients/${id}`).del().expect(204);
      await staff(`clients/${id}`).get().expect(404);
      await staff(`clients/${id}`).patch({ name: 'x' }).expect(404);
    });

    it('ficha soma o que foi pago e mostra a última visita', async () => {
      const c = (await staff('clients').post({ name: 'Cliente Fiel', phone: '11922223333' }).expect(201)).body;
      const ontem = at('10:00', addDays(todayIn(TZ), -3));
      const a = (await appt({ clientId: c.id, startsAt: ontem, allowOutsideHours: true }).expect(201)).body;
      await staff(`appointments/${a.id}`).patch({ status: 'CONCLUIDO' }).expect(200);
      const ficha = (await staff(`clients/${c.id}`).get().expect(200)).body;
      expect(ficha.stats.spentCents).toBe(5000);
      expect(ficha.stats.lastVisit).toBe(ontem);
    });
  });

  describe('agendamentos e bloqueios', () => {
    it('cliente obrigatório, inexistente e serviço desativado', async () => {
      await appt({ startsAt: at('09:00') }).expect(400);
      await appt({ clientId: NOPE, startsAt: at('09:00') }).expect(404);
      await appt({ newClient: { name: 'Sem Telefone' }, startsAt: at('09:00') }).expect(201);
      const barbaOff = (await staff(`services/${barba}`).patch({ active: false }).expect(200)).body;
      expect(barbaOff.active).toBe(false);
      await appt({ newClient: { name: 'Barbudo' }, serviceId: barba, startsAt: at('10:00') }).expect(400);
      await staff(`services/${barba}`).patch({ active: true }).expect(200);
    });

    it('edição: preço, observação, profissional inexistente, conflito e fora do horário', async () => {
      const a = (await appt({ newClient: { name: 'Edita' }, startsAt: at('11:00') }).expect(201)).body;
      const editado = (await staff(`appointments/${a.id}`).patch({ priceCents: 6500, notes: 'Trazer foto' }).expect(200)).body;
      expect(editado).toMatchObject({ priceCents: 6500, notes: 'Trazer foto' });
      await staff(`appointments/${NOPE}`).patch({ notes: 'x' }).expect(404);
      await staff(`appointments/${a.id}`).patch({ memberId: NOPE }).expect(404);
      await staff(`appointments/${a.id}`).patch({ memberId: ids['Rita Recepção'] }).expect(400); // não atende na agenda
      const fora = await staff(`appointments/${a.id}`).patch({ startsAt: at('03:00') }).expect(400);
      expect(fora.body.message).toMatch(/Fora do horário/);
      await staff(`appointments/${a.id}`).patch({ startsAt: at('03:00'), allowOutsideHours: true }).expect(200);
      const outro = (await staff(`appointments/${a.id}`).patch({ memberId: ids['Paula Pro'], startsAt: at('11:00') }).expect(200)).body;
      expect(outro.memberName).toBe('Paula Pro');
    });

    it('profissional: não vê a agenda de outro, não marca para outro e não mexe em bloqueio da unidade', async () => {
      await staff(`agenda/slots?date=${DAY}&serviceId=${corte}&memberId=${ids['Dona Regras']}`, paula).get().expect(403);
      await staff(`agenda/slots?date=${DAY}&serviceId=${corte}&memberId=${ids['Paula Pro']}`, paula).get().expect(200);
      await staff(`agenda/slots?date=${DAY}&serviceId=${corte}`, paula).get().expect(200);

      const minha = (await appt({ memberId: ids['Paula Pro'], newClient: { name: 'Da Paula' }, startsAt: at('13:00') }, paula).expect(201)).body;
      await staff(`appointments/${minha.id}`, paula).patch({ memberId: ids['Dona Regras'] }).expect(403);

      const unidade = (await staff('blocks').post({ startsAt: at('17:00'), endsAt: at('18:00'), reason: 'Reunião' }).expect(201)).body;
      await staff('blocks', paula).post({ startsAt: at('17:00'), endsAt: at('18:00') }).expect(403);
      await staff(`blocks/${unidade.id}`, paula).del().expect(403);
      const doDono = (await staff('blocks').post({ memberId: ids['Dona Regras'], startsAt: at('15:00'), endsAt: at('15:30') }).expect(201)).body;
      await staff(`blocks/${doDono.id}`, paula).del().expect(403);
      const dela = (await staff('blocks', paula).post({ memberId: ids['Paula Pro'], startsAt: at('15:00'), endsAt: at('16:00') }).expect(201)).body;
      expect(dela.reason).toBeNull();
      await staff(`blocks/${dela.id}`, paula).del().expect(204);
      await staff(`blocks/${doDono.id}`).del().expect(204);
      await staff(`blocks/${unidade.id}`).del().expect(204);
      await staff(`blocks/${NOPE}`).del().expect(404);
    });

    it('bloqueio: fim depois do início e profissional válido', async () => {
      await staff('blocks').post({ startsAt: at('10:00'), endsAt: at('10:00') }).expect(400);
      await staff('blocks').post({ memberId: NOPE, startsAt: at('10:00'), endsAt: at('11:00') }).expect(404);
    });
  });

  describe('lista de espera', () => {
    it('recusa pedido sem cliente, com cliente/serviço/profissional de outro negócio', async () => {
      await staff('waitlist').post({}).expect(400);
      await staff('waitlist').post({ clientId: NOPE }).expect(404);
      const c = (await staff('clients').post({ name: 'Na Fila' }).expect(201)).body;
      await staff('waitlist').post({ clientId: c.id, serviceId: NOPE }).expect(404);
      await staff('waitlist').post({ clientId: c.id, memberId: NOPE }).expect(404);
      const ok = (await staff('waitlist').post({ clientId: c.id, serviceId: corte, memberId: ids['Dona Regras'], notes: 'Manhã' }).expect(201)).body;
      expect(ok).toMatchObject({ serviceName: 'Corte', memberName: 'Dona Regras', preferredDate: null });
    });

    it('cancelar um horário que já passou não abre vaga', async () => {
      const c = (await staff('clients').post({ name: 'Histórico' }).expect(201)).body;
      const passado = (await appt({ clientId: c.id, startsAt: at('10:00', addDays(todayIn(TZ), -2)), allowOutsideHours: true }).expect(201)).body;
      await staff(`appointments/${passado.id}`).patch({ status: 'CANCELADO' }).expect(200);
      const fila = (await staff('waitlist').get().expect(200)).body as { openSlot: unknown }[];
      expect(fila.every((e) => e.openSlot === null)).toBe(true);
    });
  });

  describe('página pública e reserva', () => {
    it('mostra endereço e só os serviços/profissionais que atendem online', async () => {
      const page = (await http.get(pub(`orgs/${slug}`)).expect(200)).body;
      expect(page.unit.name).toBeTruthy();
      expect(page.services.map((s: { name: string }) => s.name).sort()).toEqual(['Barba', 'Corte']);
      expect(page.professionals.map((p: { name: string }) => p.name)).not.toContain('Rita Recepção');
    });

    it('horários: profissional inexistente ou que não atende; serviço desativado', async () => {
      await http.get(pub(`orgs/${slug}/slots?date=${DAY}&serviceId=${corte}&memberId=${NOPE}`)).expect(404);
      await http.get(pub(`orgs/${slug}/slots?date=${DAY}&serviceId=${corte}&memberId=${ids['Rita Recepção']}`)).expect(400);
      await http.get(pub(`orgs/${slug}/slots?date=${DAY}&serviceId=${NOPE}`)).expect(404);
      await http.get(pub(`orgs/nao-existe/slots?date=${DAY}&serviceId=${corte}`)).expect(404);
    });

    let token = '';
    it('reserva para outra pessoa: completa o cadastro de quem já existia', async () => {
      // Primeiro a mãe marca para si, sem e-mail nem nascimento.
      const a = await book({ name: 'Ana Mãe', phone: '11977770000', startsAt: at('09:00') }).expect(201);
      token = a.body.token;
      // Depois marca para o filho (primeiro nome igual não vale: é outra pessoa) e informa e-mail e nascimento.
      await book({ name: 'Ana Mãe', phone: '11977770000', patientName: 'Davi Filho', patientBirthDate: '2018-05-05', relationship: 'MAE', email: 'ana-mae@x.test', startsAt: at('10:00') }).expect(201);
      // Volta pelo próprio nome, agora com e-mail e nascimento: completa a ficha dela.
      await book({ name: 'Ana Mãe', phone: '11977770000', patientBirthDate: '1990-01-01', email: 'ana-mae@x.test', startsAt: at('11:00') }).expect(201);
      const clientes = (await staff('clients?q=Ana').get().expect(200)).body as { name: string; birthDate: string | null; email: string | null }[];
      expect(clientes.find((c) => c.name === 'Ana Mãe')).toMatchObject({ birthDate: '1990-01-01', email: 'ana-mae@x.test' });
      expect(clientes.find((c) => c.name === 'Davi Filho')).toMatchObject({ birthDate: '2018-05-05' });
    });

    it('depois de 2 h do horário o link não cancela nem remarca', async () => {
      const a = (await book({ name: 'Tarde Demais', phone: '11966660000', startsAt: at('12:00') }).expect(201)).body;
      await db.query(`UPDATE ${quotedTable(db, Appointment)} SET starts_at = now() + interval '30 minutes', ends_at = now() + interval '70 minutes' WHERE id = $1`, [await idOf(a.token)]);
      await http.post(pub(`bookings/${a.token}/cancel`)).expect(400);
      await http.post(pub(`bookings/${a.token}/reschedule`)).send({ startsAt: at('13:00') }).expect(400);
      await http.post(pub(`bookings/${a.token}/group/cancel`)).send({}).expect(400);
      // Já passou da hora de confirmar? Ainda dá, o horário é futuro; mas depois de confirmado, confirmar de novo é inofensivo.
      await http.post(pub(`bookings/${a.token}/group/confirm`)).send({}).expect(200);
      await http.post(pub(`bookings/${a.token}/group/confirm`)).send({}).expect(200);
    });

    async function idOf(t: string) {
      return (await http.get(pub(`bookings/${t}/group`)).expect(200)).body.items[0].id as string;
    }

    it('confirmar: item de outra reserva, e horário que não pode mais ser confirmado', async () => {
      const id = await idOf(token);
      await http.post(pub(`bookings/${token}/group/confirm`)).send({ itemId: NOPE }).expect(404);
      await http.post(pub(`bookings/${token}/group/reschedule`)).send({ itemId: NOPE, startsAt: at('12:00') }).expect(404);
      await http.post(pub(`bookings/${token}/group/confirm`)).send({ itemId: id }).expect(200);
      await staff(`appointments/${id}`).patch({ status: 'CANCELADO' }).expect(200);
      await http.post(pub(`bookings/${token}/group/confirm`)).send({}).expect(400);
    });

    it('link assinado de um agendamento que sumiu não abre nada; link adulterado também não', async () => {
      const secret = app.get(ConfigService).getOrThrow<string>('jwt.secret');
      const link = signReminderLink(secret, NOPE, Date.now() + 3_600_000);
      await http.get(pub(`bookings/${link}/group`)).expect(404);
      await http.get(pub(`bookings/${link}x/group`)).expect(404);
    });

    it('em sequência: precisa de 2 a 5 procedimentos diferentes e todos devem existir', async () => {
      await http.get(pub(`orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${corte},${corte}`)).expect(400);
      await http.get(pub(`orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${corte},${NOPE}`)).expect(404);
      const ok = (await http.get(pub(`orgs/${slug}/slots/sequence?date=${DAY}&serviceIds=${corte},${barba}`)).expect(200)).body;
      expect(ok.options.length).toBeGreaterThan(0);
    });

    it('reserva em grupo com e-mail: o link chega por e-mail e o grupo tem o mesmo paciente', async () => {
      const r = await http
        .post(pub(`orgs/${slug}/bookings/group`))
        .send({ name: 'Grupo Feliz', phone: '11955551111', email: 'grupo@x.test', items: [{ serviceId: corte, startsAt: at('15:00') }, { serviceId: barba, startsAt: at('16:00') }] })
        .expect(201);
      expect(r.body.items).toHaveLength(2);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
      expect(box.some((m) => m.to === 'grupo@x.test' && m.link?.includes(`/reserva/${r.body.token}`))).toBe(true);
    });
  });

  describe('Minhas reservas: bordas', () => {
    const PHONE = '11944440000';
    const code = (phone = PHONE) => http.post(pub(`orgs/${slug}/my-bookings/code`)).send({ phone });

    it('depois de 5 pedidos por hora o código para de ser enviado, sem avisar', async () => {
      await book({ name: 'Portal Pessoa', phone: PHONE, email: 'portal@x.test', startsAt: at('17:00') }).expect(201);
      for (let i = 0; i < 7; i++) await code().expect(200).expect({ sent: true });
      await new Promise((r) => setTimeout(r, 200));
      const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; code?: string }[];
      expect(box.filter((m) => m.to === 'portal@x.test' && m.code)).toHaveLength(5);
    });

    it('página inexistente, sessão malformada e lista vazia', async () => {
      await http.post(pub('orgs/nao-existe/my-bookings/code')).send({ phone: PHONE }).expect(404);
      await http.get(pub(`orgs/${slug}/my-bookings`)).set('authorization', 'Bearer semponto').expect(401);
      await http.get(pub(`orgs/${slug}/my-bookings`)).set('authorization', 'Bearer .').expect(401);
      const body = Buffer.from(JSON.stringify({ o: 'x', p: 'y', exp: 1 })).toString('base64url');
      await http.get(pub(`orgs/${slug}/my-bookings`)).set('authorization', `Bearer ${body}.abc`).expect(401);
    });
  });
});
