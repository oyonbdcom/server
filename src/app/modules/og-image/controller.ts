import { createCanvas } from 'canvas';
import { catchAsync } from '../../../shared/catchAsync';

import { loadImage, registerFont } from 'canvas';

import path from 'path';

// ১. ফন্ট রেজিস্ট্রেশন ফিক্স: family নাম এবং weight স্পষ্টভাবে উল্লেখ করা হয়েছে
const fontPath = path.join(process.cwd(), 'src', 'fonts', 'HindSiliguri-Bold.ttf');
console.log('Loading font from:', fontPath);

registerFont(fontPath, {
  family: 'Hind Siliguri',
  weight: 'bold',
});

const generateOGImage = catchAsync(async (req, res) => {
  const name = (req.query.name as string) || 'Sasthik - সাস্থিক';
  const specialty = (req.query.specialty as string) || 'স্মার্ট ডিজিটাল স্বাস্থ্যসেবা';
  const location = (req.query.location as string) || 'দিনাজপুর';
  const imageUrl = req.query.image as string; // ডক্টর ইমেজ কুয়েরি প্যারামিটার

  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ২. ব্যাকগ্রাউন্ড গ্রাডিয়েন্ট
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#10b981');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // ৩. ব্র্যান্ড আইডেন্টিটি (উইন্ডোজে স্পেস ওয়ালা ফন্টের জন্য ডাবল কোটেশন ব্যবহার করা হয়েছে)
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 45px "Hind Siliguri"';
  ctx.fillText('Sasthik', 70, 90);

  // ৪. মূল টেক্সট কন্টেন্ট (ডাক্তারের নাম)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 75px "Hind Siliguri"';
  ctx.fillText(name, 70, height / 2 - 20);

  // ৫. অতিরিক্ত তথ্য (স্পেশালিটি এবং লোকেশন)
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 40px "Hind Siliguri"'; // ওয়ার্নিং এড়াতে এখানেও bold যুক্ত করা হয়েছে
  ctx.fillText(`${specialty}`, 70, height / 2 + 55);
  ctx.fillText(`${location}`, 70, height / 2 + 110);

  // ৬. ডাক্তারের ছবি যোগ করা (যদি থাকে)
  if (imageUrl) {
    try {
      const doctorImg = await loadImage(imageUrl);

      // ছবিটিকে বৃত্তাকার করার জন্য ক্লিপিং মাস্ক
      const imgSize = 350;
      const x = 750; // ছবির পজিশন (ডানে)
      const y = height / 2 - imgSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // ছবি ড্র করা
      ctx.drawImage(doctorImg, x, y, imgSize, imgSize);
      ctx.restore();

      // ছবির চারপাশে সাদা বর্ডার
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch (error) {
      console.log('Image load failed, showing text only layout.', error);
    }
  }

  // ৭. ইমেজ সরাসরি রেসপন্স হিসেবে পাঠানো
  const buffer = canvas.toBuffer('image/png');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});
export const OgImageController = {
  generateOGImage,
};
