import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomFileTypeValidator } from 'src/utils/validators/custom-file-type.validator';
import { AuthService } from './auth.service';
import { SkipAuth } from './decorators/skip-auth.decorator';
import { SignInDto } from './dtos/sign-in.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ClearAllTokensInterceptor } from './interceptors/clear-all-tokens.interceptor';
import { ClearTokensInterceptor } from './interceptors/clear-tokens.interceptor';
import { TokensInterceptor } from './interceptors/tokens.interceptor';
import { RequestWithAuthPayload } from './interfaces/request-with-auth-payload.interface';

const MAX_AVATAR_SIZE_IN_BYTES = 2 * 1024 * 1024;
const VALID_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png'];

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
  @UseInterceptors(FileInterceptor('avatar'))
  updateProfile(
    @Request() req: RequestWithAuthPayload,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(
          new CustomFileTypeValidator({ fileTypes: VALID_AVATAR_MIME_TYPES }),
        )
        .addMaxSizeValidator({ maxSize: MAX_AVATAR_SIZE_IN_BYTES })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    avatar?: Express.Multer.File,
  ) {
    return this.authService.updateProfile(
      req.auth!.sub,
      updateProfileDto,
      avatar,
    );
  }

  @HttpCode(200)
  @Post('logout')
  @UseInterceptors(ClearTokensInterceptor)
  signOut(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }

  @HttpCode(200)
  @Post('logout-all')
  @UseInterceptors(ClearAllTokensInterceptor)
  signOutAll(@Request() req: RequestWithAuthPayload) {
    return req.auth;
  }
}
