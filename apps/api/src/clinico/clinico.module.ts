import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicoController, PublicDocumentsController } from './clinico.controller';
import { ClinicoService } from './clinico.service';
import { ClinicalRecord } from './entities/clinical-record.entity';
import { DocumentTemplate } from './entities/document-template.entity';
import { PatientDocument } from './entities/patient-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicalRecord, DocumentTemplate, PatientDocument])],
  controllers: [ClinicoController, PublicDocumentsController],
  providers: [ClinicoService],
})
export class ClinicoModule {}
