import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientPackage, PackageUse } from './entities/client-package.entity';
import { GiftCard } from './entities/gift-card.entity';
import { LoyaltyEntry } from './entities/loyalty-entry.entity';
import { ClientMembership, MembershipPlan, MembershipUse } from './entities/membership.entity';
import { PackagePlan } from './entities/package-plan.entity';
import { Review } from './entities/review.entity';
import {
  GiftCardsController,
  LoyaltyController,
  MembershipsController,
  PackagesController,
  PublicReviewsController,
  ReviewsController,
} from './fidelizacao.controller';
import { GiftCardsService } from './gift-cards.service';
import { LoyaltyService } from './loyalty.service';
import { MembershipsService } from './memberships.service';
import { PackagesService } from './packages.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([PackagePlan, ClientPackage, PackageUse, MembershipPlan, ClientMembership, MembershipUse, GiftCard, LoyaltyEntry, Review])],
  controllers: [PackagesController, MembershipsController, GiftCardsController, LoyaltyController, ReviewsController, PublicReviewsController],
  providers: [PackagesService, MembershipsService, GiftCardsService, LoyaltyService, ReviewsService],
  exports: [GiftCardsService],
})
export class FidelizacaoModule {}
