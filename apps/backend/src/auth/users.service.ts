import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface PublicUser {
  id: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return (
      (await this.usersRepository.findOne({
        where: { email: email.trim().toLowerCase() },
      })) ?? undefined
    );
  }

  async findById(id: string): Promise<PublicUser | undefined> {
    const user = await this.usersRepository.findOne({ where: { id } });
    return user ? { id: user.id, email: user.email } : undefined;
  }

  toPublicUser(user: User): PublicUser {
    return { id: user.id, email: user.email };
  }
}
