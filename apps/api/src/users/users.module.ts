import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { ExportService } from './export.service';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthIdentity])],
  controllers: [UsersController],
  providers: [UsersService, ExportService],
  exports: [UsersService],
})
export class UsersModule {}
