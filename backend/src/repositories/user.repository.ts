import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async listAll(page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count(),
    ]);
    return { data, total };
  }

  async updateRole(id: string, role: UserRole) {
    return prisma.user.update({ where: { id }, data: { role } });
  }

  async updateProfile(id: string, data: { name?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }
}

export const userRepository = new UserRepository();
