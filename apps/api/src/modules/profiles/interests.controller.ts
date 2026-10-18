import { Controller, Get, Post, Body, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import type { InterestItem, CreateInterestPayload } from '@platform/api-contracts';
import { createInterestSchema } from '@platform/validation';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe.js';
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

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a custom or community-sourced passion to the permanent database' })
  @SwaggerResponse({ status: 201, description: 'Interest created or found in taxonomy' })
  async createInterest(
    @Body(new AppValidationPipe(createInterestSchema)) body: CreateInterestPayload
  ): Promise<InterestItem> {
    const row = await this.interestRepo.findOrCreate({
      name: body.name,
      category: body.category,
    });
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
    };
  }
}
