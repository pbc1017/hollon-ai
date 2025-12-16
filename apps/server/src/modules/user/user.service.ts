import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }

    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      order: { lastName: 'ASC', firstName: 'ASC' },
      relations: ['organization'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      relations: ['organization'],
    });
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { organizationId },
      order: { lastName: 'ASC', firstName: 'ASC' },
      relations: ['organization'],
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException(
          `User with email ${dto.email} already exists`,
        );
      }
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }
}
