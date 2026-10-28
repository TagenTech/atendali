import { csvSafe, parseBirthDate, parseCsv, previewClientImport, toCsv } from './csv';

describe('parseCsv', () => {
  it('lê aspas, separador ; e quebra de linha dentro do campo', () => {
    expect(parseCsv('﻿Nome;Obs\r\n"Ana; Maria";"disse ""oi""\nok"\n\n')).toEqual([
      ['Nome', 'Obs'],
      ['Ana; Maria', 'disse "oi"\nok'],
    ]);
  });
  it('detecta vírgula e tab', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('escrita segura', () => {
  it('neutraliza fórmula', () => {
    expect(csvSafe('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(csvSafe('+5511999990000')).toBe(`'+5511999990000`);
    expect(csvSafe('-1')).toBe(`'-1`);
    expect(csvSafe('@soma')).toBe(`'@soma`);
    expect(csvSafe('Ana')).toBe('Ana');
    expect(csvSafe(null)).toBe('');
  });
  it('toCsv escapa e neutraliza', () => {
    expect(toCsv([['a;b', '=1+1', 'x"y']])).toBe('﻿"a;b";\'=1+1;"x""y"\r\n');
  });
});

describe('parseBirthDate', () => {
  it('aceita BR e ISO, recusa data impossível', () => {
    expect(parseBirthDate('05/03/1990')).toBe('1990-03-05');
    expect(parseBirthDate('1990-03-05')).toBe('1990-03-05');
    expect(parseBirthDate('31/02/1990')).toBeNull();
    expect(parseBirthDate('abc')).toBeNull();
  });
});

describe('previewClientImport', () => {
  const none = { people: [] as { phone: string; name: string }[], emails: [] as string[] };
  it('valida linha a linha e deduplica por celular e nome (irmãos podem dividir o telefone)', () => {
    const csv = [
      'Nome;Celular;E-mail;Nascimento;Etiquetas;Observações',
      'Ana Souza;(11) 98888-7777;ANA@x.com;05/03/1990;vip|retorno;alergia a látex',
      'ANA  souza;11988887777;;;;',
      'Beto;11977776666;beto@x.com;;;',
      ';11966665555;;;;',
      'Caio;123;;;;',
      'Duda;;duda@;;;',
      'Eva;;;31/02/2000;;',
      'Fábio;11955554444;;;;',
      'Filha da Ana;11988887777;;;;',
    ].join('\n');
    const p = previewClientImport(csv, { people: [{ phone: '11977776666', name: 'beto' }], emails: [] });
    expect(p.fatal).toBeNull();
    expect(p.counts).toEqual({ ok: 3, duplicated: 2, errors: 4, total: 9 });
    expect(p.rows[8]).toMatchObject({ status: 'OK', label: 'Filha da Ana' });
    expect(p.rows[0].data).toMatchObject({ phone: '11988887777', email: 'ana@x.com', birthDate: '1990-03-05', tags: ['vip', 'retorno'], notes: 'alergia a látex' });
    expect(p.rows[1]).toMatchObject({ status: 'DUPLICADO', reason: 'Já cadastrado (mesmo celular e nome)', line: 3 });
    expect(p.rows[2].status).toBe('DUPLICADO');
    expect(p.rows.filter((r) => r.status === 'ERRO').map((r) => r.reason)).toEqual([
      'Falta o nome',
      'Celular inválido — use DDD + número',
      'E-mail inválido',
      'Nascimento inválido — use DD/MM/AAAA',
    ]);
  });
  it('sem celular, deduplica por e-mail', () => {
    const p = previewClientImport('nome,email\nA,a@x.com\nB,A@x.com\nC,c@x.com', { people: [], emails: ['c@x.com'] });
    expect(p.rows.map((r) => r.status)).toEqual(['OK', 'DUPLICADO', 'DUPLICADO']);
  });
  it('erros gerais do arquivo', () => {
    expect(previewClientImport('', none).fatal).toMatch(/linhas/);
    expect(previewClientImport('celular\n11999990000', none).fatal).toMatch(/Nome/);
    expect(previewClientImport('nome\n' + Array(1001).fill('x').join('\n'), none).fatal).toMatch(/Máximo/);
  });
  it('não deixa fórmula virar problema: o texto é guardado como veio', () => {
    const p = previewClientImport('nome\n=cmd|calc', none);
    expect(p.rows[0].data?.name).toBe('=cmd|calc');
  });
});
