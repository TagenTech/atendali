import { MigrationInterface, QueryRunner } from "typeorm";
import { lockdownSupabaseTables } from "../database/supabase-lockdown";

export class CaixaComandasComissoes1793157973956 implements MigrationInterface {
    name = 'CaixaComandasComissoes1793157973956'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "skedulei_orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "number" integer NOT NULL, "status" character varying(12) NOT NULL, "client_id" uuid, "discount_cents" integer NOT NULL DEFAULT '0', "notes" character varying(300), "opened_by_member_id" uuid NOT NULL, "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "closed_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_01c0980d51325fbe8e58fccc96a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b94dec6ef0ee48da6354b68126" ON "skedulei_orders" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1563d5e0dece29bda74bd3556e" ON "skedulei_orders" ("closed_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8a3978fd78012983a81b4f014" ON "skedulei_orders" ("organization_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a7c37b4565f5f4c4eeee98df29" ON "skedulei_orders" ("organization_id", "number") `);
        await queryRunner.query(`CREATE TABLE "skedulei_order_payments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "order_id" uuid NOT NULL, "cash_session_id" uuid NOT NULL, "method" character varying(16) NOT NULL, "amount_cents" integer NOT NULL, "fee_cents" integer NOT NULL DEFAULT '0', "member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6ad11a2c87e285bfae5c644ee32" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d3331ad1ff54f553adbca3c6e4" ON "skedulei_order_payments" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8cd7c58a89dd79347a92044a3" ON "skedulei_order_payments" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_904e035e04d0d1351b9630ede6" ON "skedulei_order_payments" ("cash_session_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_order_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "order_id" uuid NOT NULL, "kind" character varying(12) NOT NULL, "service_id" uuid, "appointment_id" uuid, "member_id" uuid, "description" character varying(160) NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_price_cents" integer NOT NULL, "discount_cents" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b501bdcb2e79615f6b4a23e97c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1bf9ee971fd2f782649d95cec0" ON "skedulei_order_items" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2fbac0ae22fb774ecbe57ac26" ON "skedulei_order_items" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa61f63348e43556d7099ec003" ON "skedulei_order_items" ("appointment_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_commission_entries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "member_id" uuid NOT NULL, "order_id" uuid NOT NULL, "order_item_id" uuid NOT NULL, "description" character varying(160) NOT NULL, "base_cents" integer NOT NULL, "bps" integer NOT NULL, "amount_cents" integer NOT NULL, "payout_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2b7127413dfad8b5181c2c094ed" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_735c9ee0a16cc7ea834be719e8" ON "skedulei_commission_entries" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1cb722c85bfa7d708c9be6316d" ON "skedulei_commission_entries" ("organization_id", "member_id", "payout_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_commission_advances" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "member_id" uuid NOT NULL, "amount_cents" integer NOT NULL, "note" character varying(200), "date" date NOT NULL, "payout_id" uuid, "created_by_member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dabc01f1f853aebf89c8ae2367a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1333da12d06935af9febbd8872" ON "skedulei_commission_advances" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_commission_payouts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "member_id" uuid NOT NULL, "commissions_cents" integer NOT NULL, "advances_cents" integer NOT NULL, "total_cents" integer NOT NULL, "entries" integer NOT NULL, "created_by_member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_51acb74cd5e6c431acc364d125d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_362abd12b87774fc238cb82b29" ON "skedulei_commission_payouts" ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "skedulei_cash_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "opened_by_member_id" uuid NOT NULL, "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "opening_cents" integer NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE, "closed_by_member_id" uuid, "counted_cents" integer, "notes" character varying(300), CONSTRAINT "PK_c3e2358e03d5b75b5dc8caeb63a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_db1a9ea57bf6180e6ceb09e933" ON "skedulei_cash_sessions" ("organization_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b7af45df31fccf306b1a8df063" ON "skedulei_cash_sessions" ("organization_id", "unit_id") WHERE "closed_at" IS NULL`);
        await queryRunner.query(`CREATE TABLE "skedulei_cash_movements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "session_id" uuid NOT NULL, "kind" character varying(12) NOT NULL, "amount_cents" integer NOT NULL, "note" character varying(200), "member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d77dcc129254c77e86a0a17a01c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cf6b9e88d1ea08ed75ec4579be" ON "skedulei_cash_movements" ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f7c92f2c4a0b705878d18bfa7" ON "skedulei_cash_movements" ("session_id") `);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "payment_methods" jsonb`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "commission_base" character varying(8) NOT NULL DEFAULT 'BRUTO'`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" ADD "order_seq" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "skedulei_services" ADD "commission_bps" integer`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" ADD "commission_bps" integer`);
        await queryRunner.query(`ALTER TABLE "skedulei_orders" ADD CONSTRAINT "FK_b94dec6ef0ee48da6354b68126d" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_orders" ADD CONSTRAINT "FK_91dfceed401e4cda4c6e6227bbf" FOREIGN KEY ("client_id") REFERENCES "skedulei_clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_payments" ADD CONSTRAINT "FK_d3331ad1ff54f553adbca3c6e46" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_payments" ADD CONSTRAINT "FK_a8cd7c58a89dd79347a92044a3b" FOREIGN KEY ("order_id") REFERENCES "skedulei_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" ADD CONSTRAINT "FK_1bf9ee971fd2f782649d95cec05" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" ADD CONSTRAINT "FK_e2fbac0ae22fb774ecbe57ac26f" FOREIGN KEY ("order_id") REFERENCES "skedulei_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" ADD CONSTRAINT "FK_ebf60f7da4ebec7413559cc07a9" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" ADD CONSTRAINT "FK_735c9ee0a16cc7ea834be719e8a" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" ADD CONSTRAINT "FK_8c533dedc4958cac310fe2eb3d7" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" ADD CONSTRAINT "FK_cc3d3aa00a799b6548a374b058b" FOREIGN KEY ("order_id") REFERENCES "skedulei_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_advances" ADD CONSTRAINT "FK_1333da12d06935af9febbd8872e" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_advances" ADD CONSTRAINT "FK_aebe93b07a68d8840d778f48240" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_payouts" ADD CONSTRAINT "FK_362abd12b87774fc238cb82b295" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_payouts" ADD CONSTRAINT "FK_23437501c6f621de18225eec096" FOREIGN KEY ("member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" ADD CONSTRAINT "FK_db1a9ea57bf6180e6ceb09e933a" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" ADD CONSTRAINT "FK_3b52d0e944d42ed857b8e1299fd" FOREIGN KEY ("opened_by_member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" ADD CONSTRAINT "FK_4834299de96095a21bd3e9f405a" FOREIGN KEY ("closed_by_member_id") REFERENCES "skedulei_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_movements" ADD CONSTRAINT "FK_cf6b9e88d1ea08ed75ec4579bea" FOREIGN KEY ("organization_id") REFERENCES "skedulei_organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await lockdownSupabaseTables(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skedulei_cash_movements" DROP CONSTRAINT "FK_cf6b9e88d1ea08ed75ec4579bea"`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" DROP CONSTRAINT "FK_4834299de96095a21bd3e9f405a"`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" DROP CONSTRAINT "FK_3b52d0e944d42ed857b8e1299fd"`);
        await queryRunner.query(`ALTER TABLE "skedulei_cash_sessions" DROP CONSTRAINT "FK_db1a9ea57bf6180e6ceb09e933a"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_payouts" DROP CONSTRAINT "FK_23437501c6f621de18225eec096"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_payouts" DROP CONSTRAINT "FK_362abd12b87774fc238cb82b295"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_advances" DROP CONSTRAINT "FK_aebe93b07a68d8840d778f48240"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_advances" DROP CONSTRAINT "FK_1333da12d06935af9febbd8872e"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" DROP CONSTRAINT "FK_cc3d3aa00a799b6548a374b058b"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" DROP CONSTRAINT "FK_8c533dedc4958cac310fe2eb3d7"`);
        await queryRunner.query(`ALTER TABLE "skedulei_commission_entries" DROP CONSTRAINT "FK_735c9ee0a16cc7ea834be719e8a"`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" DROP CONSTRAINT "FK_ebf60f7da4ebec7413559cc07a9"`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" DROP CONSTRAINT "FK_e2fbac0ae22fb774ecbe57ac26f"`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_items" DROP CONSTRAINT "FK_1bf9ee971fd2f782649d95cec05"`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_payments" DROP CONSTRAINT "FK_a8cd7c58a89dd79347a92044a3b"`);
        await queryRunner.query(`ALTER TABLE "skedulei_order_payments" DROP CONSTRAINT "FK_d3331ad1ff54f553adbca3c6e46"`);
        await queryRunner.query(`ALTER TABLE "skedulei_orders" DROP CONSTRAINT "FK_91dfceed401e4cda4c6e6227bbf"`);
        await queryRunner.query(`ALTER TABLE "skedulei_orders" DROP CONSTRAINT "FK_b94dec6ef0ee48da6354b68126d"`);
        await queryRunner.query(`ALTER TABLE "skedulei_members" DROP COLUMN "commission_bps"`);
        await queryRunner.query(`ALTER TABLE "skedulei_services" DROP COLUMN "commission_bps"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "order_seq"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "commission_base"`);
        await queryRunner.query(`ALTER TABLE "skedulei_organizations" DROP COLUMN "payment_methods"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f7c92f2c4a0b705878d18bfa7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf6b9e88d1ea08ed75ec4579be"`);
        await queryRunner.query(`DROP TABLE "skedulei_cash_movements"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7af45df31fccf306b1a8df063"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db1a9ea57bf6180e6ceb09e933"`);
        await queryRunner.query(`DROP TABLE "skedulei_cash_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_362abd12b87774fc238cb82b29"`);
        await queryRunner.query(`DROP TABLE "skedulei_commission_payouts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1333da12d06935af9febbd8872"`);
        await queryRunner.query(`DROP TABLE "skedulei_commission_advances"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1cb722c85bfa7d708c9be6316d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_735c9ee0a16cc7ea834be719e8"`);
        await queryRunner.query(`DROP TABLE "skedulei_commission_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa61f63348e43556d7099ec003"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2fbac0ae22fb774ecbe57ac26"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bf9ee971fd2f782649d95cec0"`);
        await queryRunner.query(`DROP TABLE "skedulei_order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_904e035e04d0d1351b9630ede6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8cd7c58a89dd79347a92044a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3331ad1ff54f553adbca3c6e4"`);
        await queryRunner.query(`DROP TABLE "skedulei_order_payments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7c37b4565f5f4c4eeee98df29"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8a3978fd78012983a81b4f014"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1563d5e0dece29bda74bd3556e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b94dec6ef0ee48da6354b68126"`);
        await queryRunner.query(`DROP TABLE "skedulei_orders"`);
    }

}
