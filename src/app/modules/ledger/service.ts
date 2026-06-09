import prisma from '../../../prisma/client';

export const createLedgerEntry = async (
  userId: string,
  data: any, // অথবা আপনার নির্দিষ্ট টাইপ
) => {
  return await prisma.$transaction(async (tx) => {
    const diagnostic = await tx.diagnostic.findFirst({
      where: { userId: userId },
      select: { id: true },
    });

    if (!diagnostic) throw new Error('Diagnostic not found');

    return await tx.walletLedger.create({
      data: {
        ...data,
        diagId: diagnostic.id, // সরাসরি আইডিটি এখানে সেট করুন
      },
    });
  });
};

// ২. পেজিনেশন (Pagination) যোগ করা
// অনেক বড় হিস্ট্রি থাকলে ডাটাবেস স্লো হয়ে যায়, তাই পেজিনেশন জরুরি
export const getLedgerByDiagId = async (diagId: string, page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  return await prisma.walletLedger.findMany({
    where: { diagId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
};

// ৩. এটমিক আপডেট নিশ্চিত করা
export const updateLedgerStatus = async (
  id: string,
  status: 'PENDING' | 'COMPLETED' | 'FAILED',
) => {
  // নিশ্চিত করা যে আইডি বিদ্যমান
  return await prisma.walletLedger.update({
    where: { id },
    data: { status },
  });
};
export const WalletService = {
  createLedgerEntry,
  getLedgerByDiagId,
  updateLedgerStatus,
};
