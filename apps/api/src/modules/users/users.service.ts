import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserRole } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

interface ListFilters {
  role?: string;
  page?: number;
  limit?: number;
  q?: string;
}

const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  departments: {
    select: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    user: AuthenticatedUser,
    filters: ListFilters,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(filters.role ? { role: filters.role as UserRole } : {}),
      ...(filters.q
        ? {
            OR: [
              { fullName: { contains: filters.q, mode: 'insensitive' as const } },
              { email: { contains: filters.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(user: AuthenticatedUser, dto: CreateUserDto): Promise<unknown> {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: user.tenantId, email: dto.email } },
    });

    if (existing) {
      throw new ConflictException(
        `A user with email "${dto.email}" already exists in this tenant.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const created = await this.prisma.user.create({
      data: {
        tenantId: user.tenantId,
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash,
        ...(dto.departmentIds?.length
          ? {
              departments: {
                create: dto.departmentIds.map((departmentId) => ({
                  departmentId,
                })),
              },
            }
          : {}),
      },
      select: USER_SELECT,
    });

    return created;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<unknown> {
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!target) {
      throw new NotFoundException(`User "${id}" not found.`);
    }

    if (user.id === id && dto.role !== undefined) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.departmentIds !== undefined) {
        await tx.userDepartment.deleteMany({ where: { userId: id } });
        if (dto.departmentIds.length > 0) {
          await tx.userDepartment.createMany({
            data: dto.departmentIds.map((departmentId) => ({
              userId: id,
              departmentId,
            })),
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: updateData,
        select: USER_SELECT,
      });
    });

    return updated;
  }

  async remove(user: AuthenticatedUser, id: string): Promise<unknown> {
    if (user.id === id) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!target) {
      throw new NotFoundException(`User "${id}" not found.`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });
  }
}
