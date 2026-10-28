import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BookingService } from './booking.service';
import { PublicBookingDto, PublicSlotsQueryDto } from './dto/agenda.dto';

/** Agendamento online: página do negócio, horários livres e reserva — sem login. */
@ApiTags('agendamento online')
@Public()
@Controller('public')
export class PublicBookingController {
  constructor(private readonly booking: BookingService) {}

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
}
