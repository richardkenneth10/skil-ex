import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dtos/sign-in.dto';
import { AuthGuard } from './guards/auth.guard';
import { SkipAuth } from './decorators/skip-auth.decorator';
import { SignUpDto } from './dtos/sign-up.dto';
import { Response } from 'express';
import { TokensInterceptor } from './interceptors/tokens.interceptor';
import { RequestWithAuthPayload } from './interfaces/request-with-auth-payload.interface';
import { ClearAllTokensInterceptor } from './interceptors/clear-all-tokens.interceptor';
import { ClearTokensInterceptor } from './interceptors/clear-tokens.interceptor';
import { AdminGuard } from './guards/admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @SkipAuth()
  @UseInterceptors(TokensInterceptor)
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('login')
  @SkipAuth()
  @UseInterceptors(TokensInterceptor)
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Request() req: RequestWithAuthPayload) {
    return req.auth!;
    // this.authService.getProfile(req.auth!.sub);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @UseInterceptors(ClearTokensInterceptor)
  sigOut(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @UseInterceptors(ClearAllTokensInterceptor)
  signOutAll(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }
}
