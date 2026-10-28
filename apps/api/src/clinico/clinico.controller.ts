import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DOCUMENT_KINDS, Permission as P, type DocumentKind } from '@skedulei/contracts';
import { Public } from '../common/decorators/public.decorator';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import type { RequestContext } from '../security/request-context';
import { ClinicalRecordDto, DocumentTemplateDto, SendDocumentDto, SubmitDocumentDto } from './dto/clinico.dto';
import { ClinicoService } from './clinico.service';

const ctxOf = (req: Request): RequestContext => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const kindOf = (k?: string): DocumentKind => ((DOCUMENT_KINDS as readonly string[]).includes(k ?? '') ? (k as DocumentKind) : 'ANAMNESE');

@ApiTags('clínico')
@ApiBearerAuth()
@Controller('org')
export class ClinicoController {
  constructor(private readonly clinico: ClinicoService) {}

  // ---- prontuário (só quem tem acesso clínico: dono e profissionais)

  @Get('clients/:id/records')
  @OrgRoute(P.CLINICAL_RECORDS)
  records(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.clinico.listRecords(org, id, ctxOf(req));
  }

  @Post('clients/:id/records')
  @OrgRoute(P.CLINICAL_RECORDS)
  createRecord(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClinicalRecordDto, @Req() req: Request) {
    return this.clinico.createRecord(org, id, dto, ctxOf(req));
  }

  @Delete('records/:id')
  @HttpCode(204)
  @OrgRoute(P.CLINICAL_RECORDS)
  async deleteRecord(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.clinico.deleteRecord(org, id, ctxOf(req));
  }

  // ---- modelos de ficha e de termo

  @Get('documents/templates')
  @OrgRoute(P.CLIENTS_VIEW)
  templates(@CurrentOrg() org: OrgContext, @Query('tipo') kind?: string) {
    return this.clinico.templates(org, kindOf(kind));
  }

  @Post('documents/templates')
  @OrgRoute(P.ORG_MANAGE)
  createTemplate(@CurrentOrg() org: OrgContext, @Body() dto: DocumentTemplateDto) {
    return this.clinico.createTemplate(org, dto);
  }

  @Patch('documents/templates/:id')
  @OrgRoute(P.ORG_MANAGE)
  updateTemplate(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentTemplateDto) {
    return this.clinico.updateTemplate(org, id, dto);
  }

  // ---- documentos de um paciente

  @Get('clients/:id/documents')
  @OrgRoute(P.CLIENTS_VIEW)
  documents(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.clinico.documents(org, id);
  }

  @Post('clients/:id/documents')
  @OrgRoute(P.CLIENTS_VIEW)
  send(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendDocumentDto, @Req() req: Request) {
    return this.clinico.send(org, id, dto.templateId, ctxOf(req));
  }

  @Get('documents/:id')
  @OrgRoute(P.CLINICAL_RECORDS)
  document(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.clinico.getDocument(org, id, ctxOf(req));
  }

  @Post('documents/:id/complete')
  @HttpCode(200)
  @OrgRoute(P.CLINICAL_RECORDS)
  complete(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitDocumentDto, @Req() req: Request) {
    return this.clinico.completeByStaff(org, id, dto, ctxOf(req));
  }

  @Delete('documents/:id')
  @HttpCode(204)
  @OrgRoute(P.CLIENTS_VIEW)
  async removeDocument(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.clinico.removeDocument(org, id);
  }
}

/** O paciente (ou o responsável) preenche pelo link, sem login. */
@ApiTags('clínico')
@Public()
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private readonly clinico: ClinicoService) {}

  @Get(':token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  open(@Param('token') token: string) {
    return this.clinico.publicDocument(token);
  }

  @Post(':token')
  @HttpCode(200)
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  submit(@Param('token') token: string, @Body() dto: SubmitDocumentDto, @Req() req: Request) {
    return this.clinico.submitPublic(token, dto, req.ip);
  }
}
