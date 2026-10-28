import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaController, ClientsController, TvController } from './agenda.controller';
import { AppointmentsService } from './appointments.service';
import { BookingService } from './booking.service';
import { ClientsService } from './clients.service';
import { Appointment } from './entities/appointment.entity';
import { ScheduleBlock } from './entities/block.entity';
import { Client } from './entities/client.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { PublicBookingController } from './public.controller';
import { SchedulingService } from './scheduling.service';
import { TvService } from './tv.service';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Appointment, ScheduleBlock, WaitlistEntry])],
  controllers: [AgendaController, ClientsController, PublicBookingController, TvController],
  providers: [SchedulingService, AppointmentsService, ClientsService, BookingService, WaitlistService, TvService],
})
export class AgendaModule {}
