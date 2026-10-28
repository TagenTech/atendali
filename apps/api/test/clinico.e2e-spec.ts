/**
 * Módulo clínico: prontuário, modelos de anamnese/termo e documentos pelo link do paciente (banco skedulei_test).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ORG_HEADER } from '@skedulei/contracts';
import { ClinicalRecord } from '../src/clinico/entities/clinical-record.entity';
import { PatientDocument } from '../src/clinico/entities/patient-document.entity';
import { createTestApp, newOrg, quotedTable, registerUser } from './helpers';

type Session = Awaited<ReturnType<typeof registerUser>>;

describe('Módulo clínico (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let dona: Session;
  let pro: Session;
  let outra: Session;
  let recepcao: Session;
  let gerente: Session;
  let orgId = '';
  let otherOrgId = '';
  let clientId = '';
  const inOrg = (s: Session, id = orgId) => ({ ...s.auth, [ORG_HEADER]: id });

  async function joinTeam(email: string, role: string, name: string, bookable = false) {
    await http.post('/v1/org/members').set(inOrg(dona)).send({ name, email, role, bookable }).expect(201);
    const box = (await http.get('/v1/dev/outbox').expect(200)).body as { to: string; link?: string }[];
    const token = box.find((m) => m.to === email && m.link?.includes('/convite?'))!.link!.split('token=')[1];
    const s = await registerUser(http, name, email);
    await http.post('/v1/invites/accept').set(s.auth).send({ token }).expect(201);
    return s;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    dona = await registerUser(http, 'Dra. Helena', 'helena-clinico@skedulei.test');
    const org = await http.post('/v1/organizations').set(dona.auth).send(newOrg('Clínica Clínico', { segment: 'CLINICA_MEDICA' })).expect(201);
    orgId = org.body.id;
    outra = await registerUser(http, 'Outra Dona', 'outra-clinico@skedulei.test');
    otherOrgId = (await http.post('/v1/organizations').set(outra.auth).send(newOrg('Outra Clínica', { segment: 'CLINICA_MEDICA' })).expect(201)).body.id;
    pro = await joinTeam('pro-clinico@skedulei.test', 'PROFISSIONAL', 'Dr. Paulo', true);
    recepcao = await joinTeam('rec-clinico@skedulei.test', 'RECEPCAO', 'Rita Recepção');
    gerente = await joinTeam('ger-clinico@skedulei.test', 'GERENTE', 'Gabi Gerente');
    clientId = (await http.post('/v1/org/clients').set(inOrg(dona)).send({ name: 'Sofia Costa', phone: '11988887777' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('módulos sem tela não ligam; os de saúde ligados vêm com o segmento', async () => {
    const org = (await http.get('/v1/org').set(inOrg(dona)).expect(200)).body;
    expect(org.features).toEqual(expect.arrayContaining(['ANAMNESE', 'TERMOS', 'PRONTUARIO']));
    expect(org.features).not.toEqual(expect.arrayContaining(['TELECONSULTA']));
    const up = await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['PRONTUARIO', 'FOTOS', 'SALAS', 'CONVENIOS'] }).expect(200);
    expect(up.body.features).toEqual(['PRONTUARIO']);
    await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['ANAMNESE', 'TERMOS', 'PRONTUARIO'] }).expect(200);
  });

  describe('prontuário', () => {
    let recordId = '';

    it('só quem tem acesso clínico lê e escreve (dono e profissional); gerente e recepção não', async () => {
      for (const s of [recepcao, gerente]) {
        await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(s)).expect(403);
        await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(s)).send({ kind: 'EVOLUCAO', content: 'x' }).expect(403);
      }
      await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(pro)).expect(200);
    });

    it('grava cifrado, valida e lista com o autor', async () => {
      const created = await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(pro)).send({ kind: 'EVOLUCAO', title: 'Retorno', content: 'Febre há 2 dias. Alergia a dipirona.' }).expect(201);
      recordId = created.body.id;
      expect(created.body).toMatchObject({ authorName: 'Dr. Paulo', canDelete: true, kind: 'EVOLUCAO' });
      const [raw] = (await db.query(`SELECT content_encrypted FROM ${quotedTable(db, ClinicalRecord)}`)) as { content_encrypted: string }[];
      expect(raw.content_encrypted).not.toContain('dipirona');
      await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(pro)).send({ kind: 'EVOLUCAO', content: '  ' }).expect(400);
      await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(pro)).send({ kind: 'OUTRO', content: 'x' }).expect(400);
      await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(pro)).send({ kind: 'ATESTADO', content: 'a'.repeat(8001) }).expect(400);
      const list = (await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(dona)).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ content: 'Febre há 2 dias. Alergia a dipirona.', authorName: 'Dr. Paulo', canDelete: false }); // a dona não é a autora
    });

    it('acessos ficam registrados (quem abriu e quem escreveu)', async () => {
      const rows = (await db.query(`SELECT type FROM skedulei_security_events WHERE type LIKE 'RECORD_%' ORDER BY created_at`)) as { type: string }[];
      expect(rows.map((r) => r.type)).toEqual(expect.arrayContaining(['RECORD_VIEWED', 'RECORD_CREATED']));
    });

    it('só o autor apaga e só em 24 h; paciente de outro negócio não é alcançável', async () => {
      await http.delete(`/v1/org/records/${recordId}`).set(inOrg(dona)).expect(403);
      await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(outra, otherOrgId)).expect(404);
      await http.post(`/v1/org/clients/${clientId}/records`).set(inOrg(outra, otherOrgId)).send({ kind: 'EVOLUCAO', content: 'invasão' }).expect(404);
      await http.delete(`/v1/org/records/${recordId}`).set(inOrg(outra, otherOrgId)).expect(404);
      // Passadas 24 h, nem o autor apaga.
      await db.query(`UPDATE ${quotedTable(db, ClinicalRecord)} SET created_at = now() - interval '25 hours' WHERE id = $1`, [recordId]);
      await http.delete(`/v1/org/records/${recordId}`).set(inOrg(pro)).expect(403);
      await db.query(`UPDATE ${quotedTable(db, ClinicalRecord)} SET created_at = now() WHERE id = $1`, [recordId]);
      await http.delete(`/v1/org/records/${recordId}`).set(inOrg(pro)).expect(204);
      expect((await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(dona)).expect(200)).body).toHaveLength(0);
    });

    it('com o módulo desligado, a API recusa', async () => {
      await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['ANAMNESE', 'TERMOS'] }).expect(200);
      await http.get(`/v1/org/clients/${clientId}/records`).set(inOrg(dona)).expect(403);
      await http.patch('/v1/org').set(inOrg(dona)).send({ features: ['ANAMNESE', 'TERMOS', 'PRONTUARIO'] }).expect(200);
    });
  });

  describe('modelos e documentos pelo link', () => {
    let anamnese: { id: string; questions: { id: string }[] };
    let termo: { id: string };
    let doc: { id: string; link: string };
    let token = '';

    it('os modelos de exemplo nascem sozinhos, com o segmento; só quem administra edita', async () => {
      const list = (await http.get('/v1/org/documents/templates?tipo=ANAMNESE').set(inOrg(recepcao)).expect(200)).body;
      expect(list).toHaveLength(1);
      anamnese = list[0];
      expect(anamnese.questions.length).toBeGreaterThan(4);
      termo = (await http.get('/v1/org/documents/templates?tipo=TERMO').set(inOrg(dona)).expect(200)).body[0];
      expect((await http.get('/v1/org/documents/templates?tipo=ANAMNESE').set(inOrg(dona)).expect(200)).body).toHaveLength(1); // não duplica
      const body = { kind: 'ANAMNESE', title: 'Anamnese pediátrica', questions: [{ id: 'queixa', label: 'Queixa principal', type: 'TEXTO', required: true }, { id: 'vacinas', label: 'Vacinas em dia?', type: 'SIM_NAO' }] };
      await http.post('/v1/org/documents/templates').set(inOrg(recepcao)).send(body).expect(403);
      await http.post('/v1/org/documents/templates').set(inOrg(dona)).send({ ...body, questions: [] }).expect(400);
      const ped = (await http.post('/v1/org/documents/templates').set(inOrg(dona)).send(body).expect(201)).body;
      await http.patch(`/v1/org/documents/templates/${ped.id}`).set(inOrg(dona)).send({ ...body, title: 'Anamnese infantil' }).expect(200);
      await http.patch(`/v1/org/documents/templates/${ped.id}`).set(inOrg(outra, otherOrgId)).send(body).expect(404);
      anamnese = ped;
    });

    it('recepção envia o link, mas não lê as respostas; o link vem uma vez só', async () => {
      doc = (await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(recepcao)).send({ templateId: anamnese.id }).expect(201)).body;
      expect(doc.link).toMatch(/\/documento\/[\w-]+$/);
      token = doc.link.split('/documento/')[1];
      const list = (await http.get(`/v1/org/clients/${clientId}/documents`).set(inOrg(recepcao)).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0].link).toBeUndefined();
      expect(list[0].status).toBe('PENDENTE');
      await http.get(`/v1/org/documents/${doc.id}`).set(inOrg(recepcao)).expect(403);
      await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(outra, otherOrgId)).send({ templateId: anamnese.id }).expect(404);
    });

    it('o paciente abre o link, valida as respostas e preenche uma vez só', async () => {
      const page = (await http.get(`/v1/public/documents/${token}`).expect(200)).body;
      expect(page).toMatchObject({ organizationName: 'Clínica Clínico', patientFirstName: 'Sofia', completed: false, title: 'Anamnese infantil' });
      expect(page.questions).toHaveLength(2);
      await http.post(`/v1/public/documents/${token}`).send({ answers: {} }).expect(400); // falta a obrigatória
      await http.post(`/v1/public/documents/${token}`).send({ answers: { queixa: 'Febre', vacinas: 'talvez' } }).expect(400);
      await http.post(`/v1/public/documents/${token}`).send({ answers: { queixa: 'Febre', intrusa: 'x' } }).expect(400);
      await http.post(`/v1/public/documents/${token}`).send({ answers: { queixa: 123 } }).expect(400);
      await http.post(`/v1/public/documents/${token}`).send({ answers: { queixa: 'Febre há 2 dias', vacinas: 'SIM' } }).expect(200);
      await http.post(`/v1/public/documents/${token}`).send({ answers: { queixa: 'de novo' } }).expect(400);
      // Depois de preenchido, o link não mostra mais nada.
      const after = (await http.get(`/v1/public/documents/${token}`).expect(200)).body;
      expect(after).toMatchObject({ completed: true, questions: [] });
      await http.get('/v1/public/documents/token-que-nao-existe').expect(404);
    });

    it('as respostas ficam cifradas e só o acesso clínico as lê', async () => {
      const [raw] = (await db.query(`SELECT answers_encrypted, completed_via FROM ${quotedTable(db, PatientDocument)} WHERE id = $1`, [doc.id])) as { answers_encrypted: string; completed_via: string }[];
      expect(raw.answers_encrypted).not.toContain('Febre');
      expect(raw.completed_via).toBe('LINK');
      await http.get(`/v1/org/documents/${doc.id}`).set(inOrg(gerente)).expect(403);
      const detail = (await http.get(`/v1/org/documents/${doc.id}`).set(inOrg(pro)).expect(200)).body;
      expect(detail).toMatchObject({ status: 'PREENCHIDO', completedVia: 'LINK', answers: { queixa: 'Febre há 2 dias', vacinas: 'SIM' } });
      await http.get(`/v1/org/documents/${doc.id}`).set(inOrg(outra, otherOrgId)).expect(404);
      await http.delete(`/v1/org/documents/${doc.id}`).set(inOrg(dona)).expect(400); // preenchido fica no histórico
    });

    it('mudar o modelo depois não altera o que o paciente já recebeu', async () => {
      const second = (await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(dona)).send({ templateId: anamnese.id }).expect(201)).body;
      await http.patch(`/v1/org/documents/templates/${anamnese.id}`).set(inOrg(dona)).send({ kind: 'ANAMNESE', title: 'Outro nome', questions: [{ id: 'nova', label: 'Pergunta nova', type: 'TEXTO' }] }).expect(200);
      const page = (await http.get(`/v1/public/documents/${second.link.split('/documento/')[1]}`).expect(200)).body;
      expect(page.title).toBe('Anamnese infantil');
      expect(page.questions.map((q: { id: string }) => q.id)).toEqual(['queixa', 'vacinas']);
      await http.delete(`/v1/org/documents/${second.id}`).set(inOrg(recepcao)).expect(204); // pendente pode ser cancelado
    });

    it('termo: exige aceite e nome; a equipe também registra no balcão; link vencido não abre', async () => {
      const t = (await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(dona)).send({ templateId: termo.id }).expect(201)).body;
      const tk = t.link.split('/documento/')[1];
      const page = (await http.get(`/v1/public/documents/${tk}`).expect(200)).body;
      expect(page.body).toContain('Clínica Clínico');
      await http.post(`/v1/public/documents/${tk}`).send({ signedName: 'Mariana Costa' }).expect(400); // sem aceite
      await http.post(`/v1/public/documents/${tk}`).send({ accepted: true, signedName: 'Ma' }).expect(400); // nome curto
      await http.post(`/v1/public/documents/${tk}`).send({ accepted: true, signedName: 'Mariana Costa' }).expect(200);
      const done = (await http.get(`/v1/org/documents/${t.id}`).set(inOrg(pro)).expect(200)).body;
      expect(done).toMatchObject({ status: 'PREENCHIDO', signedName: 'Mariana Costa' });

      const t2 = (await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(dona)).send({ templateId: termo.id }).expect(201)).body;
      await http.post(`/v1/org/documents/${t2.id}/complete`).set(inOrg(recepcao)).send({ accepted: true, signedName: 'Mariana Costa' }).expect(403);
      await http.post(`/v1/org/documents/${t2.id}/complete`).set(inOrg(pro)).send({ accepted: true, signedName: 'Mariana Costa' }).expect(200);

      const t3 = (await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(dona)).send({ templateId: termo.id }).expect(201)).body;
      await db.query(`UPDATE ${quotedTable(db, PatientDocument)} SET expires_at = now() - interval '1 day' WHERE id = $1`, [t3.id]);
      await http.get(`/v1/public/documents/${t3.link.split('/documento/')[1]}`).expect(404);
    });

    it('documento de paciente anonimizado ou de outro negócio não é criado', async () => {
      await http.post(`/v1/org/clients/${clientId}/documents`).set(inOrg(dona)).send({ templateId: '00000000-0000-4000-8000-000000000000' }).expect(404);
      await http.post(`/v1/org/clients/not-a-uuid/documents`).set(inOrg(dona)).send({ templateId: termo.id }).expect(400);
    });
  });
});
