import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserRole } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const ALLOWED_ROLES = new Set<string>(Object.values(UserRole));

function safeRole(role: string | undefined, fallback: UserRole): UserRole {
  if (!role) return fallback;
  return (ALLOWED_ROLES.has(role) ? role : fallback) as UserRole;
}

function safeUser(user: { id: string; email: string; fullName: string; role: string; isActive: boolean; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, filters: { isActive?: boolean } = {}) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { fullName: 'asc' },
    });
    return users.map(safeUser);
  }

  async create(user: AuthenticatedUser, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: user.tenantId, email: dto.email.toLowerCase().trim() },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Bu e-posta adresi zaten kayitli.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const role = safeRole(dto.role, UserRole.OPERATOR);

    const created = await this.prisma.user.create({
      data: {
        tenantId: user.tenantId,
        email: dto.email.toLowerCase().trim(),
        fullName: dto.fullName.trim(),
        passwordHash,
        role,
        isActive: true,
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return safeUser(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Kullanici bulunamadi.');

    // Prevent self-deactivation
    if (id === user.id && dto.isActive === false) {
      throw new ForbiddenException('Kendi hesabinizi deaktive edemezsiniz.');
    }

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.role !== undefined) data.role = safeRole(dto.role, UserRole.OPERATOR);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 12);

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return safeUser(updated);
  }
}
