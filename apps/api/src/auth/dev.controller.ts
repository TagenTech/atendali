import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MailService } from '../mail/mail.service';

/** Só fora de produção: e-mails que "sairiam" sem RESEND_API_KEY (links de confirmação e senha). */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Get('outbox')
  outbox() {
    return this.mail.recent().map(({ to, subject, link, code, at }) => ({ to, subject, link, code, at }));
  }
}
