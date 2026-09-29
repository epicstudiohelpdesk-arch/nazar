import type {
  RecommendationExperimentAssignmentRow,
  NewRecommendationExperimentAssignmentRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';

export const EXPERIMENTS_REPOSITORY_TOKEN = Symbol('EXPERIMENTS_REPOSITORY_TOKEN');

export interface IExperimentsRepository {
  findAssignment(
    userId: string,
    experimentId: string
  ): Promise<RecommendationExperimentAssignmentRow | null>;
  createAssignment(
    data: NewRecommendationExperimentAssignmentRow
  ): Promise<RecommendationExperimentAssignmentRow>;
}
