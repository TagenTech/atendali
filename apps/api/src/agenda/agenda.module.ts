import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaController, ClientsController, TvController } from './agenda.controller';
import { AppointmentsService } from './appointments.service';
import { BookingService } from './booking.service';
import { ClientsService } from './clients.service';
import { Appointment } from './entities/appointment.entity';
import { ScheduleBlock } from './entities/block.entity';
import { Client } from './entities/client.entity';
import { PortalCode } from './entities/portal-code.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { PortalService } from './portal.service';
import { PublicBookingController } from './public.controller';
import { SchedulingService } from './scheduling.service';
import { TvService } from './tv.service';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Appointment, ScheduleBlock, WaitlistEntry, PortalCode])],
  controllers: [AgendaController, ClientsController, PublicBookingController, TvController],
  providers: [SchedulingService, AppointmentsService, ClientsService, BookingService, PortalService, WaitlistService, TvService],
})
export class AgendaModule {}
