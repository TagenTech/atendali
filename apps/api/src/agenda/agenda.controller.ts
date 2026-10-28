import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission as P } from '@skedulei/contracts';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { AppointmentsService } from './appointments.service';
import { ClientsService } from './clients.service';
import { TvService } from './tv.service';
import { WaitlistService } from './waitlist.service';
import {
  ClientDto,
  ClientImportDto,
  CreateAppointmentDto,
  CreateBlockDto,
  CreateWaitlistDto,
  DayQueryDto,
  SlotsQueryDto,
  UpdateAppointmentDto,
  UpdateClientDto,
} from './dto/agenda.dto';

@ApiTags('agenda')
@ApiBearerAuth()
@Controller('org')
export class AgendaController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly waitlist: WaitlistService,
  ) {}

  /** Dia da unidade: agendamentos e bloqueios (profissional vê só os dele). */
  @Get('agenda')
  @OrgRoute(P.AGENDA_OWN)
  day(@CurrentOrg() org: OrgContext, @Query() q: DayQueryDto) {
    return this.appointments.day(org, q);
  }

  @Get('agenda/slots')
  @OrgRoute(P.AGENDA_OWN)
  slots(@CurrentOrg() org: OrgContext, @Query() q: SlotsQueryDto) {
    return this.appointments.slots(org, q);
  }

  @Get('appointments/:id')
  @OrgRoute(P.AGENDA_OWN)
  get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.get(org, id);
  }

  @Post('appointments')
  @OrgRoute(P.AGENDA_OWN)
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(org, dto);
  }

  @Patch('appointments/:id')
  @OrgRoute(P.AGENDA_OWN)
  update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(org, id, dto);
  }

  @Get('waitlist')
  @OrgRoute(P.AGENDA_OWN)
  listWaitlist(@CurrentOrg() org: OrgContext) {
    return this.waitlist.list(org);
  }

  @Post('waitlist')
  @OrgRoute(P.AGENDA_OWN)
  addWaitlist(@CurrentOrg() org: OrgContext, @Body() dto: CreateWaitlistDto) {
    return this.waitlist.create(org, dto);
  }

  @Delete('waitlist/:id')
  @OrgRoute(P.AGENDA_OWN)
  @HttpCode(204)
  resolveWaitlist(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.waitlist.resolve(org, id);
  }

  @Post('appointments/:id/call')
  @OrgRoute(P.AGENDA_OWN)
  @HttpCode(200)
  call(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.call(org, id);
  }

  @Post('blocks')
  @OrgRoute(P.AGENDA_OWN)
  createBlock(@CurrentOrg() org: OrgContext, @Body() dto: CreateBlockDto) {
    return this.appointments.createBlock(org, dto);
  }

  @Delete('blocks/:id')
  @OrgRoute(P.AGENDA_OWN)
  @HttpCode(204)
  removeBlock(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.removeBlock(org, id);
  }
}

@ApiTags('painel de TV')
@ApiBearerAuth()
@Controller('org/tv')
export class TvController {
  constructor(private readonly tv: TvService) {}

  /** O painel roda numa TV logada como recepção: precisa ver a agenda de todos. */
  @Get()
  @OrgRoute(P.AGENDA_VIEW_ALL)
  board(@CurrentOrg() org: OrgContext) {
    return this.tv.board(org);
  }
}

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('org/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @OrgRoute(P.CLIENTS_VIEW)
  list(@CurrentOrg() org: OrgContext, @Query('q') q?: string) {
    return this.clients.list(org, typeof q === 'string' ? q.slice(0, 80) : undefined);
  }

  /** Importação por CSV: primeiro a pré-visualização (não grava), depois a importação. */
  @Post('import/preview')
  @OrgRoute(P.CLIENTS_MANAGE)
  @HttpCode(200)
  importPreview(@CurrentOrg() org: OrgContext, @Body() dto: ClientImportDto) {
    return this.clients.importPreview(org, dto.csv);
  }

  @Post('import')
  @OrgRoute(P.CLIENTS_MANAGE)
  @HttpCode(200)
  importRun(@CurrentOrg() org: OrgContext, @Body() dto: ClientImportDto) {
    return this.clients.importRun(org, dto.csv);
  }

  @Get(':id')
  @OrgRoute(P.CLIENTS_VIEW)
  get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(org, id);
  }

  @Post()
  @OrgRoute(P.CLIENTS_MANAGE)
  create(@CurrentOrg() org: OrgContext, @Body() dto: ClientDto) {
    return this.clients.create(org, dto);
  }

  @Patch(':id')
  @OrgRoute(P.CLIENTS_MANAGE)
  update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(org, id, dto);
  }

  /** LGPD: apaga os dados pessoais do cliente (o histórico fica sem identificação). */
  @Delete(':id')
  @OrgRoute(P.CLIENTS_MANAGE)
  @HttpCode(204)
  remove(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.anonymize(org, id);
  }
}
