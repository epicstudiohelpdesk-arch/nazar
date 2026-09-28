import { Controller, Post, Body, Get } from '@nestjs/common';
import { z } from 'zod';
import { Idempotent } from '../src/common/decorators/idempotent.decorator.js';
import { AppValidationPipe } from '../src/common/pipes/app-validation.pipe.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import type { AuthenticatedPrincipal } from '../src/common/guards/auth.guard.js';

const testInputSchema = z.object({
  name: z.string().min(3),
  age: z.number().int().min(18),
});

@Controller('test')
export class TestRoutesController {
  private executionCount = 0;

  @Public()
  @Idempotent({ ttlSeconds: 60 })
  @Post('idempotent')
  executeIdempotentMutation(): { executionCount: number; message: string } {
    this.executionCount++;
    return {
      executionCount: this.executionCount,
      message: 'Mutation executed',
    };
  }

  @Public()
  @Post('validate')
  validateInput(
    @Body(new AppValidationPipe(testInputSchema)) body: { name: string; age: number }
  ): { received: { name: string; age: number } } {
    return { received: body };
  }

  @Public()
  @Get('boom')
  triggerInternalError(): never {
    throw new Error('Simulated internal database crash');
  }

  @Get('protected')
  getProtectedData(@CurrentUser() user: AuthenticatedPrincipal) {
    return { user };
  }
}
