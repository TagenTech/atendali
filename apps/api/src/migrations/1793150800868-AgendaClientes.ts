import { MigrationInterface, QueryRunner } from "typeorm";
import { lockdownSupabaseTables } from "../database/supabase-lockdown";

export class AgendaClientes1793150800868 implements MigrationInterface {
    name = 'AgendaClientes1793150800868'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "skedulei_clients" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(16), "email" character varying(180), "birth_date" date, "notes_encrypted" text, "tags" text array NOT NULL DEFAULT '{}', "anonymized_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e6681e15f8c97f893019b732fe9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cf4d85590551c93f15e1e402e9" ON "skedulei_clients" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_79be87c3eb9d57da2a379e9050" ON "skedulei_clients" ("organization_id", "phone") `);
        await queryRunner.query(`CREATE TABLE "skedulei_schedule_blocks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "member_id" uuid, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" character varying(120), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e63153c4a5c97a0cf6e1931b68b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_959fa8aa7df5bacbfafbeae04f" ON "skedulei_schedule_blocks" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7deb89cdde6c6e6bd237bd087c" ON "skedulei_schedule_blocks" ("organization_id", "starts_at") `);
        await queryRunner.query(`CREATE TABLE "skedulei_appointments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "client_id" uuid NOT NULL, "member_id" uuid NOT NULL, "service_id" uuid NOT NULL, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(16) NOT NULL, "price_cents" integer NOT NULL, "notes" character varying(600), "source" character varying(12) NOT NULL, "manage_token_hash" character varying(64), "created_by_member_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_269edb38231360c05511a698c8f" UNIQUE ("manage_token_hash"), CONSTRAINT "PK_56aee115b9894cb91844b7dae9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3e011c7eee54e96cb5b91d0a73" ON "skedulei_appointments" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2f5225feb3c3741c5ea4a17a0" ON "skedulei_appointments" ("client_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7c503190d2e802d4d7b69cdd0" ON "skedulei_appointments" ("member_id", "starts_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ce4a973f5d5ed819cb5e28bd2" ON "skedulei_appointments" ("organization_id", "starts_at") `);
        await queryRunner.query(`ALTER TABLE "skedulei_members" ADD "archived_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "skedulei_clients" ADD CONSTRAINT "FK_cf4d85590551c93f15e1e402e91" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" ADD CONSTRAINT "FK_959fa8aa7df5bacbfafbeae04f2" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" ADD CONSTRAINT "FK_ff7fa3114c0cb35d6290ed75fd9" FOREIGN KEY ("unit_id") REFERENCES "skedulei_units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" ADD CONSTRAINT "FK_b32670ad676baf128e18c112d0a" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" ADD CONSTRAINT "FK_3e011c7eee54e96cb5b91d0a73f" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" ADD CONSTRAINT "FK_7e9bfc52f7f8c315ff632605745" FOREIGN KEY ("unit_id") REFERENCES "skedulei_units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" ADD CONSTRAINT "FK_e2f5225feb3c3741c5ea4a17a0a" FOREIGN KEY ("client_id") REFERENCES "skedulei_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" ADD CONSTRAINT "FK_e76e7fd96e073888fdc232721bd" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" ADD CONSTRAINT "FK_8c2e1c5f9d5dd696b569a8b8d6b" FOREIGN KEY ("service_id") REFERENCES "skedulei_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await lockdownSupabaseTables(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" DROP CONSTRAINT "FK_8c2e1c5f9d5dd696b569a8b8d6b"`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" DROP CONSTRAINT "FK_e76e7fd96e073888fdc232721bd"`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" DROP CONSTRAINT "FK_e2f5225feb3c3741c5ea4a17a0a"`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" DROP CONSTRAINT "FK_7e9bfc52f7f8c315ff632605745"`);
        await queryRunner.query(`ALTER TABLE "skedulei_appointments" DROP CONSTRAINT "FK_3e011c7eee54e96cb5b91d0a73f"`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" DROP CONSTRAINT "FK_b32670ad676baf128e18c112d0a"`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" DROP CONSTRAINT "FK_ff7fa3114c0cb35d6290ed75fd9"`);
        await queryRunner.query(`ALTER TABLE "skedulei_schedule_blocks" DROP CONSTRAINT "FK_959fa8aa7df5bacbfafbeae04f2"`);
        await queryRunner.query(`ALTER TABLE "skedulei_clients" DROP CONSTRAINT "FK_cf4d85590551c93f15e1e402e91"`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" DROP COLUMN "archived_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ce4a973f5d5ed819cb5e28bd2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7c503190d2e802d4d7b69cdd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2f5225feb3c3741c5ea4a17a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e011c7eee54e96cb5b91d0a73"`);
        await queryRunner.query(`DROP TABLE "skedulei_appointments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7deb89cdde6c6e6bd237bd087c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_959fa8aa7df5bacbfafbeae04f"`);
        await queryRunner.query(`DROP TABLE "skedulei_schedule_blocks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79be87c3eb9d57da2a379e9050"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf4d85590551c93f15e1e402e9"`);
        await queryRunner.query(`DROP TABLE "skedulei_clients"`);
    }

}
