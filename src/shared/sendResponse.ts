import { Response } from 'express';

// Define the structure, making N optional with a default of undefined
type IApiResponse<T, N = undefined> = {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPage?: number;
  };
  data?: T | null;
  stats?: N;
};

export const sendResponse = <T, N = undefined>(res: Response, data: IApiResponse<T, N>) => {
  const responseData: IApiResponse<T, N> = {
    success: data.success,
    statusCode: data.statusCode,
    message: data.message || '',
    meta: data.meta,
    data: data.data || null,
    stats: data.stats,
  };

  return res.status(data.statusCode).json(responseData);
};
