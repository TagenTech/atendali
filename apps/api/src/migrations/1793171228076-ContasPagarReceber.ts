import { MigrationInterface, QueryRunner } from "typeorm";
import { lockdownSupabaseTables } from "../database/supabase-lockdown";

export class ContasPagarReceber1793171228076 implements MigrationInterface {
    name = 'ContasPagarReceber1793171228076'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "skedulei_finance_categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "type" character varying(8) NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cd3bb21fa55da4cb232b528c951" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_35d268e7e6e1c86f1444971784" ON "skedulei_finance_categories" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_finance_accounts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_48bbf6755283a3adae28c9f500e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e018353c7235c39886582ad4dd" ON "skedulei_finance_accounts" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_payables" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "description" character varying(160) NOT NULL, "category_id" uuid, "amount_cents" integer NOT NULL, "due_date" date NOT NULL, "paid_date" date, "paid_method" character varying(16), "account_id" uuid, "recurrence_id" uuid, "installment" integer, "notes" character varying(300), "created_by_member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f1fb31aad3178b639c7e8f5329" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c4e2d6831b06d4659c8973b3d2" ON "skedulei_payables" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_aba6e636ae9113ce0f544f4bbc" ON "skedulei_payables" ("organization_id", "due_date") `);
        await queryRunner.query(`CREATE TABLE "skedulei_receivables" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "description" character varying(160) NOT NULL, "source" character varying(8) NOT NULL, "order_payment_id" uuid, "order_number" integer, "category_id" uuid, "amount_cents" integer NOT NULL, "fee_cents" integer NOT NULL DEFAULT '0', "method" character varying(16), "expected_date" date NOT NULL, "received_date" date, "account_id" uuid, "notes" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7e25cc93e4973c10edd392070d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_69dd8d9d4adc156687f68844b6" ON "skedulei_receivables" ("organization_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fb3b35e32eee26b1f2e7820db7" ON "skedulei_receivables" ("order_payment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c1189947230aafc23e5dace418" ON "skedulei_receivables" ("organization_id", "expected_date") `);
        await queryRunner.query(`ALTER TABLE "skedulei_finance_categories" ADD CONSTRAINT "FK_35d268e7e6e1c86f14449717841" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_finance_accounts" ADD CONSTRAINT "FK_e018353c7235c39886582ad4dde" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" ADD CONSTRAINT "FK_c4e2d6831b06d4659c8973b3d23" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" ADD CONSTRAINT "FK_073bbd154374e8d631b74999584" FOREIGN KEY ("category_id") REFERENCES "skedulei_finance_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" ADD CONSTRAINT "FK_c78d0040652c37a8163c69ccd73" FOREIGN KEY ("account_id") REFERENCES "skedulei_finance_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" ADD CONSTRAINT "FK_69dd8d9d4adc156687f68844b6b" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" ADD CONSTRAINT "FK_fb3b35e32eee26b1f2e7820db74" FOREIGN KEY ("order_payment_id") REFERENCES "skedulei_order_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" ADD CONSTRAINT "FK_f1ced636594e509cac4bbf79ff9" FOREIGN KEY ("category_id") REFERENCES "skedulei_finance_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" ADD CONSTRAINT "FK_defb9cf800a3d0b7a3180638dd4" FOREIGN KEY ("account_id") REFERENCES "skedulei_finance_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await lockdownSupabaseTables(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" DROP CONSTRAINT "FK_defb9cf800a3d0b7a3180638dd4"`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" DROP CONSTRAINT "FK_f1ced636594e509cac4bbf79ff9"`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" DROP CONSTRAINT "FK_fb3b35e32eee26b1f2e7820db74"`);
        await queryRunner.query(`ALTER TABLE "skedulei_receivables" DROP CONSTRAINT "FK_69dd8d9d4adc156687f68844b6b"`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" DROP CONSTRAINT "FK_c78d0040652c37a8163c69ccd73"`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" DROP CONSTRAINT "FK_073bbd154374e8d631b74999584"`);
        await queryRunner.query(`ALTER TABLE "skedulei_payables" DROP CONSTRAINT "FK_c4e2d6831b06d4659c8973b3d23"`);
        await queryRunner.query(`ALTER TABLE "skedulei_finance_accounts" DROP CONSTRAINT "FK_e018353c7235c39886582ad4dde"`);
        await queryRunner.query(`ALTER TABLE "skedulei_finance_categories" DROP CONSTRAINT "FK_35d268e7e6e1c86f14449717841"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1189947230aafc23e5dace418"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb3b35e32eee26b1f2e7820db7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69dd8d9d4adc156687f68844b6"`);
        await queryRunner.query(`DROP TABLE "skedulei_receivables"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aba6e636ae9113ce0f544f4bbc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4e2d6831b06d4659c8973b3d2"`);
        await queryRunner.query(`DROP TABLE "skedulei_payables"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e018353c7235c39886582ad4dd"`);
        await queryRunner.query(`DROP TABLE "skedulei_finance_accounts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_35d268e7e6e1c86f1444971784"`);
        await queryRunner.query(`DROP TABLE "skedulei_finance_categories"`);
    }

}
