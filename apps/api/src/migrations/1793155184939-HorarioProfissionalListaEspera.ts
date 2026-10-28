import { MigrationInterface, QueryRunner } from "typeorm";
import { lockdownSupabaseTables } from "../database/supabase-lockdown";

export class HorarioProfissionalListaEspera1793155184939 implements MigrationInterface {
    name = 'HorarioProfissionalListaEspera1793155184939'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "agendei_waitlist_entries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "client_id" uuid NOT NULL, "service_id" uuid, "member_id" uuid, "preferred_date" date, "notes" character varying(300), "open_slot_starts_at" TIMESTAMP WITH TIME ZONE, "open_slot_member_id" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e316470ca06197970773dacf0de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1721b41b85b7e397bc09d7d158" ON "agendei_waitlist_entries" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d9c1bf701c1a9e805db578733" ON "agendei_waitlist_entries" ("organization_id", "resolved_at") `);
        await queryRunner.query(`ALTER TABLE "agendei_members" ADD "working_hours" jsonb`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" ADD CONSTRAINT "FK_1721b41b85b7e397bc09d7d1589" FOREIGN KEY ("organization_id") REFERENCES "agendei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" ADD CONSTRAINT "FK_e01afa39016162cb07a228ebb66" FOREIGN KEY ("client_id") REFERENCES "agendei_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" ADD CONSTRAINT "FK_0771249a4c7808f815258d47d70" FOREIGN KEY ("service_id") REFERENCES "agendei_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" ADD CONSTRAINT "FK_eeacd28e0fbcbad8ba426eaa251" FOREIGN KEY ("member_id") REFERENCES "agendei_members"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await lockdownSupabaseTables(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" DROP CONSTRAINT "FK_eeacd28e0fbcbad8ba426eaa251"`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" DROP CONSTRAINT "FK_0771249a4c7808f815258d47d70"`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" DROP CONSTRAINT "FK_e01afa39016162cb07a228ebb66"`);
        await queryRunner.query(`ALTER TABLE "agendei_waitlist_entries" DROP CONSTRAINT "FK_1721b41b85b7e397bc09d7d1589"`);
        await queryRunner.query(`ALTER TABLE "agendei_members" DROP COLUMN "working_hours"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d9c1bf701c1a9e805db578733"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1721b41b85b7e397bc09d7d158"`);
        await queryRunner.query(`DROP TABLE "agendei_waitlist_entries"`);
    }

}
