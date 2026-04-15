import { Prisma } from '@prisma/client';

export const recallRating = async (
  doctorId: string,

  tx: Prisma.TransactionClient,
) => {
  const stats = await tx.review.aggregate({
    where: { doctorId, status: 'APPROVED' },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const data = {
    averageRating: stats._avg.rating ?? 0,
    reviewsCount: stats._count.rating,
  };

  await tx.doctor.update({
    where: { id: doctorId },
    data,
  });
  return;
};
