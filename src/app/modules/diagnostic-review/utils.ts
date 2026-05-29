import { Prisma } from '@prisma/client';

export const recallRating = async (
  diagId: string,

  tx: Prisma.TransactionClient,
) => {
  const stats = await tx.diagnosticReview.aggregate({
    where: { diagId, status: 'APPROVED' },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const data = {
    averageRating: stats._avg.rating ?? 0,
    reviewsCount: stats._count.rating,
  };

  await tx.diagnostic.update({
    where: { id: diagId },
    data,
  });
  return;
};
