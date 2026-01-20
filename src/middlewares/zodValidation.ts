import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

export const zodValidate =
  (schema: ZodTypeAny) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });

      next();
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
