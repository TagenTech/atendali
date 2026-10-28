import { Controller, Headers, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { RemindersService } from './reminders.service';

/** Jobs chamados de fora (pg_cron no Supabase): protegidos por `x-cron-secret` (CRON_SECRET, mín. 32 caracteres). */
@ApiExcludeController()
@Public()
@Controller('internal/jobs')
export class JobsController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService,
  ) {}

  @Post('reminders')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async run(@Headers('x-cron-secret') given?: string) {
    const secret = this.config.get<string | null>('cronSecret');
    // Sem segredo configurado a rota nem existe (não revela nada).
    if (!secret || secret.length < 32) throw new NotFoundException();
    const a = Buffer.from(given ?? '');
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Segredo inválido');
    return this.reminders.run();
  }
}
