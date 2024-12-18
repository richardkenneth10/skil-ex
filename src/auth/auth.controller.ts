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
  Patch,
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
import { UpdateProfileDto } from './dtos/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @SkipAuth()
  @UseInterceptors(TokensInterceptor)
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @HttpCode(200)
  @Post('login')
  @SkipAuth()
  @UseInterceptors(TokensInterceptor)
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Get('profile')
  getProfile(@Request() req: RequestWithAuthPayload) {
    return this.authService.getProfile(req.auth!.sub);
  }

  @Patch('profile')
  updateProfile(
    @Request() req: RequestWithAuthPayload,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.auth!.sub, updateProfileDto);
  }

  @HttpCode(200)
  @Post('logout')
  @UseInterceptors(ClearTokensInterceptor)
  sigOut(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }

  @HttpCode(200)
  @Post('logout-all')
  @UseInterceptors(ClearAllTokensInterceptor)
  signOutAll(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }
}
