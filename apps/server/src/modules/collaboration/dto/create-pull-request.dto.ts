import { IsString, IsInt, IsOptional, IsUrl, IsUUID } from 'class-validator';

export class CreatePullRequestDto {
  @IsUUID()
  taskId: string;

  @IsInt()
  prNumber: number;

  @IsUrl()
  prUrl: string;

  @IsString()
  repository: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsUUID()
  authorHollonId?: string;
}
