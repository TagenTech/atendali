import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  maskCpf,
  type AuthProvider,
  type CompleteProfileRequest,
  type UserDto,
  type UpdateSettingsRequest,
} from '@skedulei/contracts';
import { AuthIdentity } from '../auth/entities/auth-identity.entity';
import { blindIndex, encryptField } from '../common/crypto/field-crypto';
import { User } from './entities/user.entity';

export const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Conta não encontrada');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.createQueryBuilder('t').where('LOWER(t.email) = LOWER(:email)', { email }).getOne();
  }

  /** Inclui o hash da senha — uso exclusivo do fluxo de autenticação. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('t')
      .addSelect('t.passwordHash')
      .where('LOWER(t.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<User> {
    const user = await this.repo
      .createQueryBuilder('t')
      .addSelect('t.passwordHash')
      .where('t.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Conta não encontrada');
    return user;
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.repo.update(id, { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  }

  /** Cadastro público por e-mail e senha. */
  async createWithPassword(name: string, email: string, password: string): Promise<User> {
    if (await this.findByEmail(email)) throw new ConflictException('Esse e-mail já tem conta');
    return this.repo.save(
      this.repo.create({
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        termsAcceptedAt: new Date(),
      }),
    );
  }

  /** Conta criada pelo login social: e-mail já confirmado pelo provedor, sem senha. */
  /** `emailVerified`: só vira "confirmado" se o provedor garante o e-mail (a Microsoft corporativa não garante). */
  createFromProvider(name: string, email: string, emailVerified = true): Promise<User> {
    return this.repo.save(
      this.repo.create({ name, email: email.toLowerCase(), passwordHash: null, emailVerifiedAt: emailVerified ? new Date() : null, termsAcceptedAt: new Date() }),
    );
  }

  async clearPassword(id: string) {
    await this.repo.update(id, { passwordHash: null });
  }

  async markEmailVerified(id: string) {
    await this.repo.update(id, { emailVerifiedAt: new Date() });
  }

  /** Cria ou atualiza a conta (usado pelo script `create-user`). */
  async upsert(name: string, email: string, password: string): Promise<{ user: User; created: boolean }> {
    const existing = await this.findByEmailWithPassword(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    if (existing) {
      await this.repo.update(existing.id, { name, passwordHash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() });
      return { user: await this.findById(existing.id), created: false };
    }
    const user = await this.repo.save(
      this.repo.create({ name, email: email.toLowerCase(), passwordHash, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() }),
    );
    return { user, created: true };
  }

  async updateSettings(id: string, dto: UpdateSettingsRequest): Promise<User> {
    const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) await this.repo.update(id, changes);
    return this.findById(id);
  }

  /** "Finalizar cadastro": nome completo, CPF e celular (base para a cobrança da licença no futuro). */
  async completeProfile(id: string, dto: CompleteProfileRequest): Promise<User> {
    const cpfHash = blindIndex(dto.cpf, 'cpf');
    const taken = await this.repo.count({ where: { cpfHash, id: Not(id) } });
    if (taken) throw new ConflictException('Esse CPF já está em outra conta');
    await this.repo.update(id, {
      name: dto.name,
      cpfEncrypted: encryptField(dto.cpf),
      cpfHash,
      cpfMasked: maskCpf(dto.cpf),
      phone: dto.phone,
      city: dto.city ?? null,
      state: dto.state ?? null,
      profileCompletedAt: new Date(),
    });
    return this.findById(id);
  }

  async toDto(t: User): Promise<UserDto> {
    const [withHash, ids] = await Promise.all([
      this.repo.createQueryBuilder('t').addSelect('t.passwordHash').where('t.id = :id', { id: t.id }).getOne(),
      this.identities.find({ where: { userId: t.id }, select: { provider: true } }),
    ]);
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      emailVerified: !!t.emailVerifiedAt,
      cpfMasked: t.cpfMasked,
      phone: t.phone,
      city: t.city,
      state: t.state,
      profileComplete: !!t.profileCompletedAt,
      hasPassword: !!withHash?.passwordHash,
      providers: [...new Set(ids.map((i) => i.provider as AuthProvider))],
      mfaEnabled: !!t.mfaEnabledAt,
      timezone: t.timezone,
    };
  }
}
