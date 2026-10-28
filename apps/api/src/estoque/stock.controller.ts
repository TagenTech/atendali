import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission as P } from '@agendei/contracts';
import { CurrentOrg, OrgRoute, type OrgContext } from '../organizations/org-context';
import { MovementDto, MovementsQueryDto, ProductDto, SuppliesDto, UpdateProductDto } from './dto/stock.dto';
import { StockService } from './stock.service';

/** Estoque. Ver: quem vê serviços (recepção vende produto); mexer: quem gerencia serviços. */
@ApiTags('estoque')
@ApiBearerAuth()
@Controller('org/stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('products')
  @OrgRoute(P.SERVICES_VIEW)
  list(@CurrentOrg() org: OrgContext) {
    return this.stock.list(org);
  }

  @Post('products')
  @OrgRoute(P.SERVICES_MANAGE)
  create(@CurrentOrg() org: OrgContext, @Body() dto: ProductDto) {
    return this.stock.create(org, dto);
  }

  @Patch('products/:id')
  @OrgRoute(P.SERVICES_MANAGE)
  update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.stock.update(org, id, dto);
  }

  @Get('movements')
  @OrgRoute(P.SERVICES_MANAGE)
  movements(@CurrentOrg() org: OrgContext, @Query() q: MovementsQueryDto) {
    return this.stock.movements(org, q.productId);
  }

  @Post('movements')
  @OrgRoute(P.SERVICES_MANAGE)
  move(@CurrentOrg() org: OrgContext, @Body() dto: MovementDto) {
    return this.stock.move(org, dto);
  }

  @Get('report')
  @OrgRoute(P.SERVICES_MANAGE)
  report(@CurrentOrg() org: OrgContext) {
    return this.stock.report(org);
  }

  @Get('services/:serviceId/supplies')
  @OrgRoute(P.SERVICES_VIEW)
  supplies(@CurrentOrg() org: OrgContext, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.stock.supplies(org, serviceId);
  }

  @Put('services/:serviceId/supplies')
  @OrgRoute(P.SERVICES_MANAGE)
  setSupplies(@CurrentOrg() org: OrgContext, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Body() dto: SuppliesDto) {
    return this.stock.setSupplies(org, serviceId, dto);
  }
}
