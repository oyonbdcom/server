import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import { SetupService } from './service';

// --- District Controllers ---
const createDistrict = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.createDistrict(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'District created successfully',
    data: result,
  });
});

const getAllDistricts = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.getAllDistricts();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Districts retrieved successfully',
    data: result,
  });
});

const updateDistrict = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SetupService.updateDistrict(id as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'District updated successfully',
    data: result,
  });
});

const deleteDistrict = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  await SetupService.deleteDistrict(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'District deleted successfully',
    data: null,
  });
});

// --- Area Controllers ---
const createArea = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.createArea(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Area created successfully',
    data: result,
  });
});

const getAllAreas = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.getAllAreas();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Areas retrieved successfully',
    data: result,
  });
});

const updateArea = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SetupService.updateArea(id as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Area updated successfully',
    data: result,
  });
});

const deleteArea = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  await SetupService.deleteArea(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Area deleted successfully',
    data: null,
  });
});

// --- Department Controllers ---
const createDepartment = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.createDepartment(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Department created successfully',
    data: result,
  });
});

const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
  const result = await SetupService.getAllDepartments();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Departments retrieved successfully',
    data: result,
  });
});

const updateDepartment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SetupService.updateDepartment(id as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Department updated successfully',
    data: result,
  });
});

const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  await SetupService.deleteDepartment(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Department deleted successfully',
    data: null,
  });
});

export const SetupController = {
  createDistrict,
  getAllDistricts,
  updateDistrict,
  deleteDistrict,
  createArea,
  getAllAreas,
  updateArea,
  deleteArea,
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
};
