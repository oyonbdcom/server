type SortOrder = 'asc' | 'desc';

export type IOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
};

type IOptionsReturn = {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: SortOrder;
};

/**
 * Calculate pagination parameters for Prisma queries
 */
export const paginationCalculator = (options: IOptions): IOptionsReturn => {
  const page = Number(options?.page) || 1;
  const limit = Number(options?.limit) || 10;
  const skip = (page - 1) * limit;

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder: SortOrder = options?.sortOrder || 'desc';

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
  };
};
