import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from './auth-validation.pipe.js';
import {
  CurrentUser,
} from './current-user.decorator.js';
import type { AuthenticatedUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';

const credentialsSchema = z.object({
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(credentialsSchema)) credentials: z.infer<typeof credentialsSchema>) {
    return this.authService.register(credentials.email, credentials.password);
  }

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(credentialsSchema)) credentials: z.infer<typeof credentialsSchema>) {
    return this.authService.login(credentials.email, credentials.password);
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    const currentUser = await this.authService.getCurrentUser(user.sub);

    if (!currentUser) {
      throw new UnauthorizedException('User no longer exists');
    }

    return currentUser;
  }
}
