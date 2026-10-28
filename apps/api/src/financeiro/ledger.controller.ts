import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission as P } from '@agendei/contracts';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { PeriodQueryDto } from './dto/finance.dto';
import {
  AccountDto,
  CashflowQueryDto,
  CategoryDto,
  CreatePayableDto,
  CreateReceivableDto,
  DeletePayableQueryDto,
  LedgerQueryDto,
  SettlePayableDto,
  SettleReceivableDto,
  UpdateAccountDto,
  UpdateCategoryDto,
  UpdatePayableDto,
  UpdateReceivableDto,
} from './dto/ledger.dto';
import { LedgerService } from './ledger.service';
import { ReportsService } from './reports.service';

@ApiTags('contas')
@ApiBearerAuth()
@Controller('org/finance')
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly reports: ReportsService,
  ) {}

  // ---- plano de contas e contas bancárias
  @Get('categories')
  @OrgRoute(P.FINANCE_VIEW)
  categories(@CurrentOrg() org: OrgContext) {
    return this.ledger.categories(org);
  }

  @Post('categories')
  @OrgRoute(P.FINANCE_MANAGE)
  createCategory(@CurrentOrg() org: OrgContext, @Body() dto: CategoryDto) {
    return this.ledger.createCategory(org, dto);
  }

  @Patch('categories/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  updateCategory(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.ledger.updateCategory(org, id, dto);
  }

  @Get('accounts')
  @OrgRoute(P.FINANCE_VIEW)
  accounts(@CurrentOrg() org: OrgContext) {
    return this.ledger.accounts(org);
  }

  @Post('accounts')
  @OrgRoute(P.FINANCE_MANAGE)
  createAccount(@CurrentOrg() org: OrgContext, @Body() dto: AccountDto) {
    return this.ledger.createAccount(org, dto);
  }

  @Patch('accounts/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  updateAccount(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto) {
    return this.ledger.updateAccount(org, id, dto);
  }

  // ---- contas a pagar
  @Get('payables')
  @OrgRoute(P.FINANCE_VIEW)
  payables(@CurrentOrg() org: OrgContext, @Query() q: LedgerQueryDto) {
    return this.ledger.listPayables(org, q);
  }

  @Post('payables')
  @OrgRoute(P.FINANCE_MANAGE)
  createPayable(@CurrentOrg() org: OrgContext, @Body() dto: CreatePayableDto) {
    return this.ledger.createPayable(org, dto);
  }

  @Patch('payables/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  updatePayable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePayableDto) {
    return this.ledger.updatePayable(org, id, dto);
  }

  @Post('payables/:id/pay')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(200)
  settlePayable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettlePayableDto) {
    return this.ledger.settlePayable(org, id, dto);
  }

  @Post('payables/:id/reopen')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(200)
  reopenPayable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.reopenPayable(org, id);
  }

  @Delete('payables/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(204)
  removePayable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query() q: DeletePayableQueryDto) {
    return this.ledger.removePayable(org, id, !!q.futuras);
  }

  // ---- contas a receber
  @Get('receivables')
  @OrgRoute(P.FINANCE_VIEW)
  receivables(@CurrentOrg() org: OrgContext, @Query() q: LedgerQueryDto) {
    return this.ledger.listReceivables(org, q);
  }

  @Post('receivables')
  @OrgRoute(P.FINANCE_MANAGE)
  createReceivable(@CurrentOrg() org: OrgContext, @Body() dto: CreateReceivableDto) {
    return this.ledger.createReceivable(org, dto);
  }

  @Patch('receivables/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  updateReceivable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReceivableDto) {
    return this.ledger.updateReceivable(org, id, dto);
  }

  @Post('receivables/:id/receive')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(200)
  settleReceivable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettleReceivableDto) {
    return this.ledger.settleReceivable(org, id, dto);
  }

  @Post('receivables/:id/reopen')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(200)
  reopenReceivable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.reopenReceivable(org, id);
  }

  @Delete('receivables/:id')
  @OrgRoute(P.FINANCE_MANAGE)
  @HttpCode(204)
  removeReceivable(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.removeReceivable(org, id);
  }

  // ---- relatórios
  @Get('dre')
  @OrgRoute(P.FINANCE_VIEW)
  dre(@CurrentOrg() org: OrgContext, @Query() q: PeriodQueryDto) {
    return this.reports.dre(org, q);
  }

  @Get('cashflow')
  @OrgRoute(P.FINANCE_VIEW)
  cashflow(@CurrentOrg() org: OrgContext, @Query() q: CashflowQueryDto) {
    return this.reports.cashflow(org, q);
  }
}
