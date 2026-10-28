import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793139219386 implements MigrationInterface {
    name = 'InitialSchema1793139219386'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "skedulei_users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "email" character varying(180) NOT NULL, "password_hash" character varying, "email_verified_at" TIMESTAMP WITH TIME ZONE, "cpf_encrypted" text, "cpf_hash" character varying(64), "cpf_masked" character varying(14), "phone" character varying(16), "city" character varying(80), "state" character varying(2), "terms_accepted_at" TIMESTAMP WITH TIME ZONE, "profile_completed_at" TIMESTAMP WITH TIME ZONE, "tokens_valid_after" TIMESTAMP WITH TIME ZONE, "mfa_secret_encrypted" text, "mfa_pending_secret_encrypted" text, "mfa_enabled_at" TIMESTAMP WITH TIME ZONE, "mfa_last_step" bigint, "timezone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2a8fa5047cc50d617a8fa459ff5" UNIQUE ("email"), CONSTRAINT "UQ_6614bd7736add0dc64d42ca8da4" UNIQUE ("cpf_hash"), CONSTRAINT "PK_afd5b62ab254eca494f6b77ca5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skedulei_security_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid, "type" character varying(32) NOT NULL, "ip" character varying(64), "user_agent" character varying(255), "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_070067a508f3ad52f53e235168c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_81d8506c03bf4de8239faf94e4" ON "skedulei_security_events" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "skedulei_organizations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "slug" character varying(48) NOT NULL, "segment" character varying(24) NOT NULL, "features" text array NOT NULL DEFAULT '{}', "phone" character varying(16), "document" character varying(14), "timezone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_29740cbe83ce1d1c741d5d1806e" UNIQUE ("slug"), CONSTRAINT "PK_520ebbe98c86a44bb0231f246f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skedulei_units" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "phone" character varying(16), "zip_code" character varying(8), "street" character varying(120), "number" character varying(20), "district" character varying(80), "city" character varying(80), "state" character varying(2), "timezone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo', "business_hours" jsonb NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f62ef6a67705649f6b20fdcc15" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0833bcf82a56c2a6d57690ede4" ON "skedulei_units" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_services" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "category" character varying(60), "description" character varying(600), "duration_minutes" smallint NOT NULL, "price_cents" integer NOT NULL, "online_booking" boolean NOT NULL DEFAULT true, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf3b1f7543859203016a05fc37c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0085c498e8ff44963c1b708020" ON "skedulei_services" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "user_id" uuid, "name" character varying(120) NOT NULL, "email" character varying(180), "phone" character varying(16), "role" character varying(16) NOT NULL, "status" character varying(16) NOT NULL, "bookable" boolean NOT NULL DEFAULT false, "color" smallint NOT NULL DEFAULT '1', "invite_token_hash" character varying(64), "invite_expires_at" TIMESTAMP WITH TIME ZONE, "invited_at" TIMESTAMP WITH TIME ZONE, "joined_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1fcfffb71eeeb1a60a0df900000" UNIQUE ("invite_token_hash"), CONSTRAINT "PK_27f607d08c6c4f247ef0e29ee01" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_efa0c9155b471eba73583f3910" ON "skedulei_members" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_417c95354a545a3113e9a46e58" ON "skedulei_members" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_307f20af7cf27315eabb3da496" ON "skedulei_members" ("organization_id", "email") WHERE "email" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a21d1559b4c4b67b130eb04bc6" ON "skedulei_members" ("organization_id", "user_id") WHERE "user_id" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "skedulei_refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "session_id" uuid NOT NULL DEFAULT gen_random_uuid(), "ip" character varying(64), "session_started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "user_agent" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e1f85aaee722decab9f4318cfb9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ca85a2abd159d06c16defb15c8" ON "skedulei_refresh_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_738554facaed523db81dee1568" ON "skedulei_refresh_tokens" ("session_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0b14878ffbc94d89b02a4328aa" ON "skedulei_refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "skedulei_mfa_recovery_codes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee5703727584c0f22924fa0c7c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9ad4871ed2e029cb055ae6b3b1" ON "skedulei_mfa_recovery_codes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_email_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "type" character varying(8) NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4eab676f58990bc1f565677a05e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_88e2817bce81241c856d2741c0" ON "skedulei_email_tokens" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_067b327f6085ff5c5baf6e658b" ON "skedulei_email_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "skedulei_auth_identities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "provider_user_id" character varying(255) NOT NULL, "email" character varying(180), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cbbd1ee9efc83ff909b5bde5967" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1a505738e5bfda6e6d2318ef6e" ON "skedulei_auth_identities" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bc6d092a07b81943d112387940" ON "skedulei_auth_identities" ("provider", "provider_user_id") `);
        await queryRunner.query(`ALTER TABLE "skedulei_units" ADD CONSTRAINT "FK_0833bcf82a56c2a6d57690ede4f" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_services" ADD CONSTRAINT "FK_0085c498e8ff44963c1b7080209" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" ADD CONSTRAINT "FK_efa0c9155b471eba73583f39106" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" ADD CONSTRAINT "FK_417c95354a545a3113e9a46e580" FOREIGN KEY ("user_id") REFERENCES "skedulei_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_auth_identities" ADD CONSTRAINT "FK_1a505738e5bfda6e6d2318ef6e5" FOREIGN KEY ("user_id") REFERENCES "skedulei_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skedulei_auth_identities" DROP CONSTRAINT "FK_1a505738e5bfda6e6d2318ef6e5"`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" DROP CONSTRAINT "FK_417c95354a545a3113e9a46e580"`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" DROP CONSTRAINT "FK_efa0c9155b471eba73583f39106"`);
        await queryRunner.query(`ALTER TABLE "skedulei_services" DROP CONSTRAINT "FK_0085c498e8ff44963c1b7080209"`);
        await queryRunner.query(`ALTER TABLE "skedulei_units" DROP CONSTRAINT "FK_0833bcf82a56c2a6d57690ede4f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc6d092a07b81943d112387940"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a505738e5bfda6e6d2318ef6e"`);
        await queryRunner.query(`DROP TABLE "skedulei_auth_identities"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_067b327f6085ff5c5baf6e658b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88e2817bce81241c856d2741c0"`);
        await queryRunner.query(`DROP TABLE "skedulei_email_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ad4871ed2e029cb055ae6b3b1"`);
        await queryRunner.query(`DROP TABLE "skedulei_mfa_recovery_codes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b14878ffbc94d89b02a4328aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_738554facaed523db81dee1568"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca85a2abd159d06c16defb15c8"`);
        await queryRunner.query(`DROP TABLE "skedulei_refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a21d1559b4c4b67b130eb04bc6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_307f20af7cf27315eabb3da496"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_417c95354a545a3113e9a46e58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_efa0c9155b471eba73583f3910"`);
        await queryRunner.query(`DROP TABLE "skedulei_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0085c498e8ff44963c1b708020"`);
        await queryRunner.query(`DROP TABLE "skedulei_services"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0833bcf82a56c2a6d57690ede4"`);
        await queryRunner.query(`DROP TABLE "skedulei_units"`);
        await queryRunner.query(`DROP TABLE "skedulei_organizations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81d8506c03bf4de8239faf94e4"`);
        await queryRunner.query(`DROP TABLE "skedulei_security_events"`);
        await queryRunner.query(`DROP TABLE "skedulei_users"`);
    }

}
