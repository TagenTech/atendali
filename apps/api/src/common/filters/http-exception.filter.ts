import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@skedulei/contracts';
import { captureException } from '../../instrument';

/** Normaliza erros no formato `ApiError` e nunca vaza stack trace para o cliente. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const payload: ApiError = Array.isArray(raw)
        ? { statusCode, message: 'Confira os campos', details: raw }
        : { statusCode, message: raw ?? exception.message };
      res.status(statusCode).json(payload);
      return;
    }

    this.logger.error(exception);
    captureException(exception);
    const payload: ApiError = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Algo deu errado. Tente de novo.',
    };
    res.status(payload.statusCode).json(payload);
  }
}
