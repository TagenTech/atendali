import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthProvidersDto, AuthResponse, LoginResult, MfaSetupDto, RecoveryCodesDto } from '@skedulei/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { contextOf } from '../security/request-context';
import { SecurityEventsService } from '../security/security-events.service';
import { AccountService } from './account.service';
import { AuthService, IssuedSession, LoginOutcome, OAuthError } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { DeleteAccountDto, MfaCodeDto, MfaVerifyDto } from './dto/mfa.dto';
import { ForgotPasswordDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto/register.dto';
import { OAuthService, type OAuthState } from './oauth.service';

export const REFRESH_COOKIE = 'skedulei_refresh';
const OAUTH_COOKIE = 'skedulei_oauth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly oauth: OAuthService,
    private readonly events: SecurityEventsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('providers')
  providers(): AuthProvidersDto {
    return { providers: this.oauth.enabled(), signupEnabled: this.config.get<boolean>('signupEnabled')! };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResult> {
    return this.respond(res, await this.auth.login(dto.email, dto.password, contextOf(req)));
  }

  /** Segundo passo do login com 2FA. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('mfa/verify')
  @HttpCode(200)
  async mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.verifyMfaLogin(dto.mfaToken, dto.code, contextOf(req)));
  }

  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: Number(process.env.REGISTER_THROTTLE_LIMIT ?? 10) } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.register(dto.name, dto.email, dto.password, contextOf(req)));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-email')
  @HttpCode(204)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.token, contextOf(req));
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('resend-verification')
  @HttpCode(204)
  resend(@CurrentUser() user: JwtPayload) {
    return this.auth.resendVerification(user.sub);
  }

  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(204)
  forgot(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto.email, contextOf(req));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  @HttpCode(204)
  reset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto.token, dto.password, contextOf(req));
  }

  /** Início do login social: guarda state/PKCE em cookie e manda para o provedor. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('oauth/:provider')
  oauthStart(@Param('provider') provider: string, @Res() res: Response) {
    if (!this.oauth.isProvider(provider) || !this.oauth.enabled().includes(provider)) {
      return res.redirect(302, '/login?erro=provedor');
    }
    const { url, state } = this.oauth.start(provider);
    res.cookie(OAUTH_COOKIE, Buffer.from(JSON.stringify(state)).toString('base64url'), {
      ...this.cookieOptions(),
      path: '/api/v1/auth/oauth',
      maxAge: 10 * 60_000,
    });
    return res.redirect(302, url);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = req.cookies?.[OAUTH_COOKIE] as string | undefined;
    res.clearCookie(OAUTH_COOKIE, { ...this.cookieOptions(), path: '/api/v1/auth/oauth' });
    if (error) return res.redirect(302, '/login?erro=cancelado');
    try {
      const saved = raw ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as OAuthState) : null;
      if (!saved || !this.oauth.isProvider(provider) || saved.provider !== provider || !state || saved.state !== state || !code) {
        throw new UnauthorizedException('state');
      }
      const profile = await this.oauth.finish(provider, code, saved);
      const { outcome, created } = await this.auth.signInWithProvider(profile, contextOf(req));
      if (outcome.kind === 'mfa') {
        // O ticket vai no fragmento (#): não chega a servidores nem a logs.
        return res.redirect(302, `/login/2fa#t=${outcome.mfaToken}`);
      }
      this.setRefreshCookie(res, outcome.session);
      return res.redirect(302, created ? '/hoje?bemvindo=1' : '/hoje');
    } catch (err) {
      // Só códigos fixos na URL: nada de texto livre refletido na tela de login.
      return res.redirect(302, `/login?erro=${err instanceof OAuthError ? err.code : 'falhou'}`);
    }
  }

  @Public()
  // Vários aparelhos da mesma recepção (mesmo IP) renovam a sessão a cada carregamento de página.
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    try {
      return this.withCookie(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], contextOf(req)));
    } catch (err) {
      this.clearCookie(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE], contextOf(req));
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Patch('password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword, contextOf(req));
    this.clearCookie(res);
  }

  // Sessões e atividade
  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: JwtPayload) {
    return this.auth.listSessions(user.sub, user.sid);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.auth.revokeSession(user.sub, id, contextOf(req));
  }

  @ApiBearerAuth()
  @Post('sessions/revoke-others')
  @HttpCode(204)
  revokeOthers(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.auth.revokeOtherSessions(user.sub, user.sid, contextOf(req));
  }

  @ApiBearerAuth()
  @Get('activity')
  activity(@CurrentUser() user: JwtPayload) {
    return this.events.list(user.sub);
  }

  // 2FA
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('mfa/setup')
  @HttpCode(200)
  mfaSetup(@CurrentUser() user: JwtPayload): Promise<MfaSetupDto> {
    return this.auth.mfaSetup(user.sub);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('mfa/enable')
  @HttpCode(200)
  async mfaEnable(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto, @Req() req: Request): Promise<RecoveryCodesDto> {
    return { codes: await this.auth.mfaEnable(user.sub, dto.code, contextOf(req)) };
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('mfa/disable')
  @HttpCode(204)
  mfaDisable(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto, @Req() req: Request) {
    return this.auth.mfaDisable(user.sub, dto.code, contextOf(req));
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('mfa/recovery-codes')
  @HttpCode(200)
  async mfaRecovery(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto, @Req() req: Request): Promise<RecoveryCodesDto> {
    return { codes: await this.auth.regenerateRecoveryCodes(user.sub, dto.code, contextOf(req)) };
  }

  /** Exclusão definitiva da conta (LGPD). */
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('delete-account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: JwtPayload, @Body() dto: DeleteAccountDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.account.deleteAccount(user.sub, dto, contextOf(req));
    this.clearCookie(res);
  }

  private respond(res: Response, outcome: LoginOutcome): LoginResult {
    if (outcome.kind === 'mfa') return { mfaRequired: true, mfaToken: outcome.mfaToken };
    return this.withCookie(res, outcome.session);
  }

  private setRefreshCookie(res: Response, session: IssuedSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...this.cookieOptions(), expires: session.refreshExpiresAt });
  }

  private withCookie(res: Response, session: IssuedSession): AuthResponse {
    this.setRefreshCookie(res, session);
    return session.response;
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  /**
   * Lax (e não Strict): a volta do Google/Microsoft/Meta é uma navegação vinda de outro site.
   * Continua protegido contra CSRF: o refresh é POST, e POST entre sites não leva cookie Lax.
   */
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.get<string>('env') === 'production', sameSite: 'lax', path: '/' };
  }
}
