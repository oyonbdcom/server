import { catchAsync } from '../../../shared/catchAsync';

import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// ১. ফন্ট রেজিস্ট্রেশন (Hind Siliguri)
const fontPath = path.join(process.cwd(), 'src', 'fonts', 'HindSiliguri-Bold.ttf');
registerFont(fontPath, {
  family: 'Hind Siliguri',
  weight: 'bold',
});

const generateOGImage = catchAsync(async (req, res) => {
  // আপনার ডিফল্ট ভ্যালু এবং কুয়েরি প্যারামিটার
  const name = (req.query.name as string) || 'আপনার ডিজিটাল স্বাস্থ্যসেবা';
  const specialty = (req.query.specialty as string) || 'সহজ অ্যাপয়েন্টমেন্ট ও সিরিয়াল ট্র্যাকিং';
  const location = (req.query.location as string) || 'স্বাস্থ্য রেকর্ড ম্যানেজমেন্ট';
  const imageUrl = req.query.image as string;

  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ২. ব্র্যান্ডেড ব্যাকগ্রাউন্ড গ্রাডিয়েন্ট (আপনার ব্র্যান্ড কালার অনুযায়ী)
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#0a2540'); // ডার্ক ব্লু বেজ
  gradient.addColorStop(0.4, '#1d4ed8'); // আপনার --primary কালারের কাছাকাছি রয়্যাল ব্লু
  gradient.addColorStop(1, '#1e40af');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // ৩. গ্লোবাল সার্কিট বা টেক্সচার ডিজাইন (অপশনাল ব্যাকগ্রাউন্ড ডিজাইন গ্লো)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(width - i * 100, 0);
    ctx.lineTo(width, height - i * 80);
    ctx.stroke();
  }

  // ৪. ব্র্যান্ড আইডেন্টিটি (Sasthik লোগো টেক্সট)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Hind Siliguri"';
  ctx.fillText('Sas', 80, 100);

  // লোগোর '+' আইকন ডিজাইন বা গ্রিন পার্ট
  ctx.fillStyle = '#10b981'; // প্লাস সাইনের জন্য গ্রিন
  ctx.fillText('+', 155, 100);

  ctx.fillStyle = '#ffffff';
  ctx.fillText('hik', 185, 100);

  // ৫. মূল টেক্সট কন্টেন্ট (ডাক্তারের নাম বা মেইন স্লোগান)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px "Hind Siliguri"';
  // টেক্সট যাতে স্ক্রিনের বাইরে না যায় সেজন্য ম্যাক্সিমাম উইডথ ৭০০পিএক্স ডিফাইন করা
  ctx.fillText(name, 80, height / 2 - 20, 700);

  // ৬. অতিরিক্ত তথ্য (স্পেশালিটি এবং লোকেশন / স্লোগান)
  ctx.fillStyle = '#cbd5e1'; // লাইট গ্রে টেক্সট কালার
  ctx.font = 'bold 36px "Hind Siliguri"';

  // যদি লোকেশন বা দ্বিতীয় লাইন থাকে
  if (req.query.name) {
    // ডক্টর পেজের জন্য স্পেসিফিক ডিজাইন
    ctx.fillText(specialty, 80, height / 2 + 55, 700);
    ctx.fillStyle = '#38bdf8'; // লোকেশন হাইলাইট করার জন্য স্কাই ব্লু
    ctx.fillText(`📍 ${location}`, 80, height / 2 + 115, 700);
  } else {
    // মেইন হোমপেজের স্লোগানের জন্য ক্লিন ডাবল লাইন লেআউট
    ctx.fillText(specialty, 80, height / 2 + 55, 700);
  }

  // ৭. ডানদিকের ইমেজের এরিয়া পজিশন
  const imgSize = 380;
  const x = 750;
  const y = height / 2 - imgSize / 2 + 20;

  let imageLoaded = false;

  // ৮. ডাক্তারের ছবি লোড করার ট্রাই করা (যদি ইউজার বা ডক্টর ইমেজ ইউআরএল থাকে)
  if (imageUrl) {
    try {
      const doctorImg = await loadImage(imageUrl);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(doctorImg, x, y, imgSize, imgSize);
      ctx.restore();

      // ছবির চারপাশে বর্ডার
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      imageLoaded = true;
    } catch (error) {
      console.log('Provided image failed to load, falling back to default vector graphics.');
    }
  }

  // ৯. ফলব্যাক মেকানিজম: ইমেজ না থাকলে বা ফেইল করলে ক্যানভাস দিয়ে ডিফল্ট মেডিকেল আর্ট জেনারেট করা
  if (!imageLoaded) {
    ctx.save();

    // একটি সুন্দর থ্রিডি লুকিং গ্লো সার্কেল ব্যাকগ্রাউন্ড
    const circleGlow = ctx.createRadialGradient(
      x + imgSize / 2,
      y + imgSize / 2,
      10,
      x + imgSize / 2,
      y + imgSize / 2,
      imgSize / 2,
    );
    circleGlow.addColorStop(0, '#1e3a8a');
    circleGlow.addColorStop(1, '#0f172a');
    ctx.fillStyle = circleGlow;

    ctx.beginPath();
    ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.stroke();

    // সার্কেলের ভেতর একটি মিনিমাল ক্রস/মেডিকেল লোগো বা আর্ট ড্র করা
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.beginPath();
    ctx.arc(x + imgSize / 2, y + imgSize / 2, imgSize / 3, 0, Math.PI * 2);
    ctx.fill();

    // প্লাস (+) সাইন আর্ট করা (ভেক্টর ডিজাইন হিসেবে কাজ করবে)
    ctx.fillStyle = '#10b981';
    const thickness = 30;
    const len = 140;
    // Horizontal bar
    ctx.fillRect(x + imgSize / 2 - len / 2, y + imgSize / 2 - thickness / 2, len, thickness);
    // Vertical bar
    ctx.fillRect(x + imgSize / 2 - thickness / 2, y + imgSize / 2 - len / 2, thickness, len);

    ctx.restore();
  }

  // ১০. রেসপন্স পাঠানো
  const buffer = canvas.toBuffer('image/png');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

export const OgImageController = {
  generateOGImage,
};
