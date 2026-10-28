import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { RemindersService } from './reminders.service';

@Module({ controllers: [JobsController], providers: [RemindersService] })
export class LembretesModule {}
