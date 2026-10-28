import { Body, Controller, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MailService } from '../mail/mail.service';
import { ContactDto } from './contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post()
  @HttpCode(200)
  async send(@Body() dto: ContactDto) {
    const to = process.env.CONTACT_EMAIL;
    if (!to) {
      throw new ServiceUnavailableException('O canal de contato ainda não está ativo.');
    }
    const sent = await this.mail.sendContact(to, dto.name, dto.email, dto.message);
    if (!sent) {
      throw new ServiceUnavailableException('Não conseguimos enviar agora. Tente de novo daqui a pouco.');
    }
    return { ok: true };
  }
}
