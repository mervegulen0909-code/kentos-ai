import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AuthService } from './auth.service.js';
import { JwtBlacklistGuard } from './jwt-blacklist.guard.js';

const AUTH_LOGIN_THROTTLE_TTL_MS = Number(process.env.AUTH_LOGIN_THROTTLE_TTL_MS ?? 60_000);
const AUTH_LOGIN_THROTTLE_LIMIT = Number(process.env.AUTH_LOGIN_THROTTLE_LIMIT ?? 5);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'E-posta / şifre ile giriş yap' })
  @ApiResponse({ status: 200, description: 'access_token ve refresh_token' })
  @ApiResponse({ status: 401, description: 'Geçersiz kimlik bilgileri' })
  @ApiResponse({ status: 429, description: 'Çok fazla deneme — brute-force koruması' })
  @Throttle({ default: { ttl: AUTH_LOGIN_THROTTLE_TTL_MS, limit: AUTH_LOGIN_THROTTLE_LIMIT } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Access token yenile — refresh token rotation uygulanır' })
  @ApiResponse({ status: 200, description: 'Yeni access_token ve refresh_token' })
  @ApiResponse({ status: 401, description: 'Geçersiz, süresi dolmuş veya iptal edilmiş refresh token' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @ApiOperation({ summary: 'Çıkış yap — hem access hem refresh token iptal edilir' })
  @ApiResponse({ status: 200, description: 'ok: true' })
  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.accessToken, dto.refreshToken);
  }

  @ApiOperation({ summary: 'Şifre sıfırlama talebi — e-posta ile token gönderir' })
  @ApiResponse({ status: 200, description: 'ok: true (e-posta mevcut olmasa bile)' })
  @ApiResponse({ status: 429, description: 'Çok fazla deneme' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('request-password-reset')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @ApiOperation({ summary: 'Şifre sıfırla — token ile yeni şifre belirle' })
  @ApiResponse({ status: 200, description: 'ok: true' })
  @ApiResponse({ status: 401, description: 'Geçersiz veya süresi dolmuş token' })
  @ApiResponse({ status: 429, description: 'Çok fazla deneme' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giriş yapmış kullanıcı bilgisi' })
  @ApiResponse({ status: 200, description: 'Kullanıcı profili' })
  @UseGuards(AuthGuard('jwt'), JwtBlacklistGuard)
  @Get('me')
  me(@Req() request: { user: unknown }) {
    return request.user;
  }
}
