import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PullRequestStatus } from '../entities/task-pull-request.entity';

export class ReviewSubmissionDto {
  @IsEnum(PullRequestStatus)
  decision: PullRequestStatus.APPROVED | PullRequestStatus.CHANGES_REQUESTED;

  @IsOptional()
  @IsString()
  comments?: string;
}
