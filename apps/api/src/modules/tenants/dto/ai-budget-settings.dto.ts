import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MIN_BUDGET = 1;
const MAX_TOKENS = 1_000_000_000;
const MAX_COST_MICROS = 10_000_000_000;

export class UpdateAiBudgetSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(MIN_BUDGET)
  @Max(MAX_TOKENS)
  dailyTokenBudget?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_BUDGET)
  @Max(MAX_COST_MICROS)
  dailyCostBudgetMicros?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_BUDGET)
  @Max(MAX_TOKENS)
  perRequestTokenLimit?: number;
}
