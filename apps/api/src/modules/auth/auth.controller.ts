import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'E-posta / şifre ile giriş yap' })
  @ApiResponse({ status: 200, description: 'access_token ve refresh_token' })
  @ApiResponse({ status: 401, description: 'Geçersiz kimlik bilgileri' })
  @ApiResponse({ status: 429, description: 'Çok fazla deneme — brute-force koruması' })
  // 5 deneme / 60 saniye — brute-force koruması
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Access token yenile' })
  @ApiResponse({ status: 200, description: 'Yeni access_token' })
  @ApiResponse({ status: 401, description: 'Geçersiz veya süresi dolmuş refresh token' })
  // 10 deneme / 60 saniye — refresh endpoint
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  logout() {
    return this.auth.logout();
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giriş yapmış kullanıcı bilgisi' })
  @ApiResponse({ status: 200, description: 'Kullanıcı profili' })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() request: { user: unknown }) {
    return request.user;
  }
}
