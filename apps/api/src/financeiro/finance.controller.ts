import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission as P } from '@agendei/contracts';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { CashService } from './cash.service';
import { CommissionsService } from './commissions.service';
import {
  AddPaymentDto,
  AdvanceDto,
  CashMovementDto,
  CloseCashDto,
  CommissionsQueryDto,
  CreateOrderDto,
  OpenCashDto,
  OrderItemDto,
  OrdersQueryDto,
  PayoutDto,
  PeriodQueryDto,
  UpdateOrderDto,
} from './dto/finance.dto';
import { RedeemDto } from '../fidelizacao/dto/retention.dto';
import { OrdersService } from './orders.service';

@ApiTags('caixa')
@ApiBearerAuth()
@Controller('org/cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('current')
  @OrgRoute(P.CASH_OPERATE)
  current(@CurrentOrg() org: OrgContext) {
    return this.cash.current(org);
  }

  @Get('history')
  @OrgRoute(P.FINANCE_VIEW)
  history(@CurrentOrg() org: OrgContext) {
    return this.cash.history(org);
  }

  @Post('open')
  @OrgRoute(P.CASH_OPERATE)
  open(@CurrentOrg() org: OrgContext, @Body() dto: OpenCashDto) {
    return this.cash.open(org, dto);
  }

  @Post('movements')
  @OrgRoute(P.CASH_OPERATE)
  movement(@CurrentOrg() org: OrgContext, @Body() dto: CashMovementDto) {
    return this.cash.movement(org, dto);
  }

  @Post('close')
  @OrgRoute(P.CASH_OPERATE)
  close(@CurrentOrg() org: OrgContext, @Body() dto: CloseCashDto) {
    return this.cash.close(org, dto);
  }
}

@ApiTags('comandas')
@ApiBearerAuth()
@Controller('org/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @OrgRoute(P.CASH_OPERATE)
  list(@CurrentOrg() org: OrgContext, @Query() q: OrdersQueryDto) {
    return this.orders.list(org, q);
  }

  @Post()
  @OrgRoute(P.CASH_OPERATE)
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateOrderDto) {
    return this.orders.create(org, dto);
  }

  @Get(':id')
  @OrgRoute(P.CASH_OPERATE)
  get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(org, id);
  }

  @Patch(':id')
  @OrgRoute(P.CASH_OPERATE)
  update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(org, id, dto);
  }

  @Post(':id/items')
  @OrgRoute(P.CASH_OPERATE)
  addItem(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderItemDto) {
    return this.orders.addItem(org, id, dto);
  }

  @Delete(':id/items/:itemId')
  @OrgRoute(P.CASH_OPERATE)
  removeItem(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.orders.removeItem(org, id, itemId);
  }

  @Post(':id/payments')
  @OrgRoute(P.CASH_OPERATE)
  addPayment(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddPaymentDto) {
    return this.orders.addPayment(org, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @OrgRoute(P.CASH_OPERATE)
  removePayment(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.orders.removePayment(org, id, paymentId);
  }

  /** Troca pontos de fidelidade por desconto nesta comanda (0 desfaz). */
  @Post(':id/redeem')
  @OrgRoute(P.CASH_OPERATE)
  @HttpCode(200)
  redeem(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RedeemDto) {
    return this.orders.redeem(org, id, dto.points);
  }

  @Post(':id/close')
  @OrgRoute(P.CASH_OPERATE)
  @HttpCode(200)
  close(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.close(org, id);
  }

  @Post(':id/cancel')
  @OrgRoute(P.CASH_OPERATE)
  @HttpCode(200)
  cancel(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(org, id);
  }
}

/** Comissões: financeiro vê todas; profissional vê só as dele (checado no serviço). */
@ApiTags('comissões')
@ApiBearerAuth()
@Controller('org/commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('balances')
  @OrgRoute()
  balances(@CurrentOrg() org: OrgContext) {
    return this.commissions.balances(org);
  }

  @Get('entries')
  @OrgRoute()
  entries(@CurrentOrg() org: OrgContext, @Query() q: CommissionsQueryDto) {
    return this.commissions.entries(org, q.memberId);
  }

  @Get('advances')
  @OrgRoute()
  advances(@CurrentOrg() org: OrgContext, @Query() q: CommissionsQueryDto) {
    return this.commissions.advances(org, q.memberId);
  }

  @Post('advances')
  @OrgRoute(P.FINANCE_MANAGE)
  addAdvance(@CurrentOrg() org: OrgContext, @Body() dto: AdvanceDto) {
    return this.commissions.addAdvance(org, dto);
  }

  @Get('payouts')
  @OrgRoute()
  payouts(@CurrentOrg() org: OrgContext) {
    return this.commissions.payouts(org);
  }

  @Post('payouts')
  @OrgRoute(P.FINANCE_MANAGE)
  createPayout(@CurrentOrg() org: OrgContext, @Body() dto: PayoutDto) {
    return this.commissions.createPayout(org, dto);
  }
}

@ApiTags('financeiro')
@ApiBearerAuth()
@Controller('org/finance')
export class FinanceController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('summary')
  @OrgRoute(P.FINANCE_VIEW)
  summary(@CurrentOrg() org: OrgContext, @Query() q: PeriodQueryDto) {
    return this.commissions.summary(org, q);
  }
}
