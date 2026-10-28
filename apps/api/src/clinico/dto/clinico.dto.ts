import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ANSWER_MAX,
  DOCUMENT_KINDS,
  QUESTIONS_MAX,
  RECORD_CONTENT_MAX,
  RECORD_KINDS,
  TERM_BODY_MAX,
  type ClinicalRecordInput,
  type DocQuestion,
  type DocumentKind,
  type DocumentTemplateInput,
  type QuestionType,
  type RecordKind,
  type SubmitDocumentRequest,
} from '@skedulei/contracts';
import { EmptyToNull } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ClinicalRecordDto implements ClinicalRecordInput {
  @ApiProperty({ enum: RECORD_KINDS })
  @IsIn([...RECORD_KINDS], { message: 'Tipo inválido' })
  kind: RecordKind;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Escreva a anotação' })
  @MaxLength(RECORD_CONTENT_MAX, { message: `No máximo ${RECORD_CONTENT_MAX} letras` })
  content: string;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;
}

export class DocQuestionDto implements DocQuestion {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9_-]{1,30}$/, { message: 'Código da pergunta inválido' })
  id: string;

  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Toda pergunta precisa de um texto' })
  @MaxLength(200)
  label: string;

  @ApiProperty({ enum: ['TEXTO', 'SIM_NAO', 'ESCOLHA'] })
  @IsIn(['TEXTO', 'SIM_NAO', 'ESCOLHA'])
  type: QuestionType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class DocumentTemplateDto implements DocumentTemplateInput {
  @ApiProperty({ enum: DOCUMENT_KINDS })
  @IsIn([...DOCUMENT_KINDS])
  kind: DocumentKind;

  @ApiProperty()
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome para o modelo' })
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ type: [DocQuestionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(QUESTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => DocQuestionDto)
  questions?: DocQuestionDto[];

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(TERM_BODY_MAX)
  body?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SendDocumentDto {
  @ApiProperty()
  @IsUUID('all', { message: 'Escolha o modelo' })
  templateId: string;
}

/** Preenchimento (pela equipe ou pelo paciente no link). */
export class SubmitDocumentDto implements SubmitDocumentRequest {
  @ApiPropertyOptional({ description: 'Anamnese: id da pergunta → resposta' })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  signedName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}

export { ANSWER_MAX };
