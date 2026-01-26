import { Prisma, ReviewTargetType } from '@prisma/client';

export const recallRating = async (
  targetId: string,
  targetType: ReviewTargetType,
  tx: Prisma.TransactionClient,
) => {
  const stats = await tx.review.aggregate({
    where: { targetId, targetType },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const data = {
    averageRating: stats._avg.rating ?? 0,
    reviewsCount: stats._count.rating,
  };

  if (targetType === ReviewTargetType.DOCTOR) {
    await tx.doctor.update({
      where: { userId: targetId },
      data,
    });
    return;
  }

  if (targetType === ReviewTargetType.CLINIC) {
    await tx.clinic.update({
      where: { userId: targetId },
      data,
    });
    return;
  }
};
