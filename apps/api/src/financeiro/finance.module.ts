import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashService } from './cash.service';
import { CommissionsService } from './commissions.service';
import { CashMovement } from './entities/cash-movement.entity';
import { CashSession } from './entities/cash-session.entity';
import { Advance, CommissionEntry, CommissionPayout } from './entities/commission.entity';
import { FinanceAccount, FinanceCategory, Payable, Receivable } from './entities/ledger.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { Order } from './entities/order.entity';
import { CashController, CommissionsController, FinanceController, OrdersController } from './finance.controller';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { StockModule } from '../estoque/stock.module';
import { FidelizacaoModule } from '../fidelizacao/fidelizacao.module';
import { OrderExtrasService } from './order-extras.service';
import { OrdersService } from './orders.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [StockModule, FidelizacaoModule, TypeOrmModule.forFeature([CashSession, CashMovement, Order, OrderItem, OrderPayment, CommissionEntry, Advance, CommissionPayout, FinanceCategory, FinanceAccount, Payable, Receivable])],
  controllers: [CashController, OrdersController, CommissionsController, FinanceController, LedgerController],
  providers: [CashService, OrdersService, OrderExtrasService, CommissionsService, LedgerService, ReportsService],
})
export class FinanceModule {}
