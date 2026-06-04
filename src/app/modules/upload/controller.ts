import { createCanvas } from 'canvas';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IFile, IFiles } from './interface';

const uploadSingleFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  }

  sendResponse<IFile>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'File uploaded successfully',
    data: {
      url: req.file.path,
    },
  });
});

const uploadMultipleFiles = catchAsync(async (req, res) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
  }

  const urls = req.files.map((file: Express.Multer.File) => file.path);

  sendResponse<IFiles>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Files uploaded successfully',
    data: { urls },
  });
});

// ডায়নামিক ওজি ইমেজ জেনারেশন কন্ট্রোলার
const generateOGImage = catchAsync(async (req, res) => {
  const name = (req.query.name as string) || 'Sasthik - সাস্থিক';
  const specialty = (req.query.specialty as string) || 'স্মার্ট ডিজিটাল স্বাস্থ্যসেবা';
  const location = (req.query.location as string) || 'দিনাজপুর';

  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ১. ব্যাকগ্রাউন্ড ডিজাইন (ব্র্যান্ড গ্রাডিয়েন্ট)
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a'); // Sasthik Navy
  gradient.addColorStop(1, '#10b981'); // Sasthik Emerald Green
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // ২. ব্র্যান্ড আইডেন্টিটি (Sasthik)
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 45px sans-serif';
  ctx.fillText('Sasthik', 70, 90);

  // ৩. মূল কন্টেন্ট (ডাক্তার বা ক্লিনিকের নাম)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText(name, 70, height / 2);

  // ৪. অতিরিক্ত তথ্য (স্পেশালিটি এবং লোকেশন)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '42px sans-serif';
  ctx.fillText(`${specialty} | ${location}`, 70, height / 2 + 85);

  // ৫. ডিজাইন এলিমেন্ট (হালকা ওভারলে সার্কেল)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(1050, 315, 220, 0, Math.PI * 2);
  ctx.fill();

  // ইমেজ সরাসরি রেসপন্স হিসেবে পাঠানো
  const buffer = canvas.toBuffer('image/png');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

export const FileController = {
  uploadSingleFile,
  uploadMultipleFiles,
  generateOGImage,
};
