import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PublicUser, UsersService } from './users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.usersService.create(email, password);
    return this.createSession(user.id, user.email);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user.id, user.email);
  }

  async getCurrentUser(id: string): Promise<PublicUser | undefined> {
    return this.usersService.findById(id);
  }

  private async createSession(
    id: string,
    email: string,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      email,
    });

    return {
      accessToken,
      user: { id, email },
    };
  }
}
