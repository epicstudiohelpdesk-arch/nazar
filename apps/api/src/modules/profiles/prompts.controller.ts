import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import type { PromptDefinitionItem } from '@platform/api-contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  PROMPT_REPOSITORY_TOKEN,
  type IPromptRepository,
} from './repositories/prompt.repository.js';

@ApiTags('Taxonomy & Prompts')
@Controller('v1/prompts')
export class PromptsController {
  constructor(
    @Inject(PROMPT_REPOSITORY_TOKEN)
    private readonly promptRepo: IPromptRepository
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all available curated dating prompt definitions' })
  @SwaggerResponse({ status: 200, description: 'List of active curated prompt definitions' })
  async listPrompts(): Promise<PromptDefinitionItem[]> {
    const rows = await this.promptRepo.findAllDefinitions();
    return rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      category: r.category,
      sortOrder: r.sortOrder,
    }));
  }
}
