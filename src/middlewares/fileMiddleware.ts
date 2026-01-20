import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import config from '../config/config';
import ApiError from '../utils/apiError';
const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
cloudinary.config({
  cloud_name: config.cloudinary.cloudinary_name!,
  api_key: config.cloudinary.cloudinary_api_key!,
  api_secret: config.cloudinary.cloudinary_api_secret!,
});

// Sanitize filename
const sanitize = (name: string) =>
  name
    .replace(/[^a-z0-9_\-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

// Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: `uploads/${req.user?.id || 'guest'}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: `${Date.now()}-${sanitize(file.originalname.split('.')[0])}`,
    resource_type: 'image',
    overwrite: false,
  }),
});

const uploader = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPG, PNG, WEBP allowed'));
    }
    if (file.originalname.toLowerCase().endsWith('.svg')) {
      return cb(new ApiError(400, 'SVG not allowed'));
    }
    cb(null, true);
  },
});

export const uploadSingle = uploader.single('file');
export const uploadMultiple = uploader.array('files', 10);
