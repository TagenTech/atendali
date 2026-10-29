import { BadRequestException, HttpException, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const json = jest.fn<void, [Record<string, unknown>]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('HttpExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('erro de validação vira "Confira os campos" com a lista de detalhes', () => {
    const r = run(new BadRequestException(['nome é obrigatório', 'e-mail inválido']));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ statusCode: 400, message: 'Confira os campos', details: ['nome é obrigatório', 'e-mail inválido'] });
  });

  it('mantém a mensagem do erro HTTP, em texto ou em objeto', () => {
    expect(run(new NotFoundException('Não achei')).body).toEqual({ statusCode: 404, message: 'Não achei' });
    expect(run(new HttpException('Só texto', 418)).body).toEqual({ statusCode: 418, message: 'Só texto' });
  });

  it('objeto sem "message" cai na mensagem padrão da exceção', () => {
    const r = run(new HttpException({ code: 'X' }, 409));
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('Http Exception');
  });

  it('erro inesperado vira 500 genérico, sem vazar a causa', () => {
    const r = run(new Error('senha do banco: 123'));
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('senha do banco');
    expect(r.body.message).toBe('Algo deu errado. Tente de novo.');
  });
});
