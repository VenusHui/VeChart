import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PostgresRepository } from '../../data/postgres.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: PostgresRepository,
    private readonly jwtService: JwtService
  ) {}

  async login(email: string, password: string) {
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }

  async getProfile(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}
