import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Member } from '../organizations/entities/member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { User } from './entities/user.entity';

/**
 * Exporta os dados pessoais da conta (LGPD: portabilidade). Sem hashes de senha nem tokens.
 * Dados dos negócios (clientes, agenda) são do negócio e saem pela exportação do próprio negócio.
 */
@Injectable()
export class ExportService {
  constructor(private readonly db: DataSource) {}

  async export(userId: string) {
    const table = (entity: new () => object) => `"${this.db.getMetadata(entity).tableName}"`;
    const q = (sql: string) => this.db.query(sql, [userId]);
    const [user] = await q(
      `SELECT id, name, email, phone, city, state, timezone, cpf_masked, created_at FROM ${table(User)} WHERE id = $1`,
    );
    return {
      exportedAt: new Date().toISOString(),
      app: 'Skedulei',
      user,
      teams: await q(
        `SELECT o.name AS organization, o.segment, m.name, m.role, m.status, m.bookable, m.joined_at
           FROM ${table(Member)} m JOIN ${table(Organization)} o ON o.id = m.organization_id
          WHERE m.user_id = $1 ORDER BY m.created_at`,
      ),
    };
  }
}
