import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import config from '../../config/config';
import { emailTemplates } from './templete';

dotenv.config();

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email_user,
      pass: config.email_password,
    },
  });

  /**
   * Send Email
   */
  static async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      const mailOptions = {
        from: `"Medixa Support" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📩 Email sent:', info.messageId);

      return {
        success: true,
        message: 'Email sent successfully',
        id: info.messageId,
      };
    } catch (error: any) {
      console.error('❌ Email sending failed:', error.message);
      return {
        success: false,
        message: 'Email sending failed',
        error: error.message,
      };
    }
  }
}
export async function sendVerificationEmail(email: string, name: string, token: string) {
  const link = `${config.origin}/verify-email?token=${token}`;
  const template = emailTemplates.verifyEmail(name, link);
  await EmailService.sendEmail(email, template.subject, template.html, template.text);
}
