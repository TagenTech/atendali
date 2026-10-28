import { MigrationInterface, QueryRunner } from "typeorm";
import { lockdownSupabaseTables } from "../database/supabase-lockdown";

export class PersonalizacaoVisual1793197857985 implements MigrationInterface {
    name = 'PersonalizacaoVisual1793197857985'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "skedulei_organization_images" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "kind" character varying(8) NOT NULL, "mime" character varying(16) NOT NULL, "data" bytea NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b9c6108b680682afaab64889aa8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c4e8d9368da6ea4857187dee04" ON "skedulei_organization_images" ("organization_id", "kind") `);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "brand_color" character varying(12)`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "tagline" character varying(160)`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "logo_updated_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "cover_updated_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "skedulei_organization_images" ADD CONSTRAINT "FK_b50d52f331552b0f1a7ba2b02d0" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await lockdownSupabaseTables(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skedulei_organization_images" DROP CONSTRAINT "FK_b50d52f331552b0f1a7ba2b02d0"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "cover_updated_at"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "logo_updated_at"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "tagline"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "brand_color"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4e8d9368da6ea4857187dee04"`);
        await queryRunner.query(`DROP TABLE "skedulei_organization_images"`);
    }

}
