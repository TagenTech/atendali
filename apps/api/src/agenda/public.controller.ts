import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BookingService } from './booking.service';
import { PortalCodeDto, PortalVerifyDto, PublicBookingDto, PublicSlotsQueryDto, RescheduleDto } from './dto/agenda.dto';
import { bearer, PortalService } from './portal.service';

/** Agendamento online: página do negócio, horários livres e reserva — sem login. */
@ApiTags('agendamento online')
@Public()
@Controller('public')
export class PublicBookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly portal: PortalService,
  ) {}

  @Get('orgs/:slug')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  page(@Param('slug') slug: string) {
    return this.booking.page(slug);
  }

  @Get('orgs/:slug/slots')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  slots(@Param('slug') slug: string, @Query() q: PublicSlotsQueryDto) {
    return this.booking.slots(slug, q);
  }

  @Post('orgs/:slug/bookings')
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  book(@Param('slug') slug: string, @Body() dto: PublicBookingDto) {
    return this.booking.book(slug, dto);
  }

  @Get('bookings/:token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  get(@Param('token') token: string) {
    return this.booking.get(token);
  }

  @Post('bookings/:token/cancel')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  cancel(@Param('token') token: string) {
    return this.booking.cancel(token);
  }

  @Post('bookings/:token/reschedule')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  reschedule(@Param('token') token: string, @Body() dto: RescheduleDto) {
    return this.booking.reschedule(token, dto);
  }

  // ---- "Minhas reservas": código no e-mail cadastrado → ver, cancelar e remarcar

  @Post('orgs/:slug/my-bookings/code')
  @HttpCode(200)
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  code(@Param('slug') slug: string, @Body() dto: PortalCodeDto) {
    return this.portal.requestCode(slug, dto.phone);
  }

  @Post('orgs/:slug/my-bookings/verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verify(@Param('slug') slug: string, @Body() dto: PortalVerifyDto) {
    return this.portal.verify(slug, dto.phone, dto.code);
  }

  @Get('orgs/:slug/my-bookings')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  mine(@Param('slug') slug: string, @Headers('authorization') auth?: string) {
    return this.portal.list(slug, bearer(auth));
  }

  @Post('orgs/:slug/my-bookings/:id/cancel')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async cancelMine(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string, @Headers('authorization') auth?: string) {
    await this.portal.cancel(slug, bearer(auth), id);
    return { ok: true };
  }

  @Post('orgs/:slug/my-bookings/:id/reschedule')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async rescheduleMine(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDto, @Headers('authorization') auth?: string) {
    await this.portal.reschedule(slug, bearer(auth), id, dto);
    return { ok: true };
  }
}
