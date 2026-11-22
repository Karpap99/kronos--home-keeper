import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppController } from '../src/app.controller.js';
import { AppService } from '../src/app.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { UsersService } from '../src/auth/users.service.js';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

class UsersServiceMock {
  private readonly users = new Map<string, {
    id: string;
    email: string;
    passwordHash: string;
  }>();

  async create(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    if (this.users.has(normalizedEmail)) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
    };
    this.users.set(normalizedEmail, user);
    return user;
  }

  async findByEmail(email: string) {
    return this.users.get(email.toLowerCase());
  }

  async findById(id: string) {
    for (const user of this.users.values()) {
      if (user.id === id) {
        return { id: user.id, email: user.email };
      }
    }
    return undefined;
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const users = new UsersServiceMock();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'e2e-test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AppController, AuthController],
      providers: [
        AppService,
        AuthService,
        Reflector,
        AuthGuard,
        { provide: UsersService, useValue: users },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('should require authentication', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('should register, log in, and access the current user', async () => {
    const email = 'test@example.com';
    const password = 'strong-password';

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(registered.body.accessToken).toBeTypeOf('string');
    expect(registered.body.user.email).toBe(email);

    const loggedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loggedIn.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.email).toBe(email);
      });
  });

  it('should reject invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'strong-password' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
