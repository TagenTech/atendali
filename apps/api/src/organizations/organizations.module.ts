import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandingService } from './branding.service';
import { CatalogService } from './catalog.service';
import { Member } from './entities/member.entity';
import { OrganizationImage } from './entities/organization-image.entity';
import { Organization } from './entities/organization.entity';
import { ServiceItem } from './entities/service-item.entity';
import { Unit } from './entities/unit.entity';
import { MembersService } from './members.service';
import { CurrentOrgController, InvitesController, OrganizationsController, PublicBrandController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationImage, Unit, Member, ServiceItem])],
  controllers: [OrganizationsController, CurrentOrgController, InvitesController, PublicBrandController],
  providers: [OrganizationsService, MembersService, CatalogService, BrandingService],
  // O AppModule registra o OrgGuard global (depois do JWT) e precisa do repositório de Member.
  exports: [TypeOrmModule],
})
export class OrganizationsModule {}
