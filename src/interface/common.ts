export interface IGenericErrors {
  path: string | number;
  message: string;
}

export interface IGenericErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: IGenericErrors[];
}

export type IGenericResponse<T, N = Record<string, unknown>> = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage?: number;
  };
  data: T;
  stats?: N; // N is optional in the object and has a default type
};

export type FilterableFields = {
  searchTerm?: string;
};
