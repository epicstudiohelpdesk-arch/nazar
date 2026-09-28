import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import type { InterestItem } from '@platform/api-contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  INTEREST_REPOSITORY_TOKEN,
  type IInterestRepository,
} from './repositories/interest.repository.js';

@ApiTags('Taxonomy & Interests')
@Controller('v1/interests')
export class InterestsController {
  constructor(
    @Inject(INTEREST_REPOSITORY_TOKEN)
    private readonly interestRepo: IInterestRepository
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all available curated interests across categories' })
  @SwaggerResponse({ status: 200, description: 'List of active curated interests' })
  async listInterests(): Promise<InterestItem[]> {
    const rows = await this.interestRepo.findAllActive();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
    }));
  }
}
