import config from '../../config/config';

export const emailTemplates = {
  // Email Verification Template
  verifyEmail: (userName: string, verificationLink: string, expiryHours = 24) => ({
    subject: 'Verify Your Email - Medixa Hospital System',
    html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
      <tr>
        <td align="center">

          <!-- Outer Card -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" 
            style="background:#ffffff;border-radius:10px;overflow:hidden;
                   box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td align="center" 
                style="background:linear-gradient(135deg,#1a73e8,#0d47a1);
                       padding:35px 20px;color:#ffffff;">
                <h1 style="margin:0;font-size:26px;font-weight:700;">Medixa Hospital System</h1>
                <p style="margin:5px 0 0;font-size:14px;opacity:.9;">
                  Secure • Reliable • Healthcare Technology
                </p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:40px 35px;color:#333333;font-size:16px;line-height:1.6;">

                <h2 style="margin-top:0;font-size:22px;font-weight:600;">
                  Hello ${userName || 'User'},
                </h2>

                <p>
                  Thank you for registering with <strong>Medixa Hospital Management System</strong>.  
                  Please verify your email to activate your account.
                </p>

                <!-- Button -->
                <div style="text-align:center;margin:30px 0;">
                  <a href="${verificationLink}"
                    style="
                      display:inline-block;
                      background:linear-gradient(135deg,#1a73e8,#0d47a1);
                      color:#ffffff !important;
                      padding:14px 35px;
                      font-size:16px;
                      border-radius:50px;
                      text-decoration:none;
                      font-weight:600;
                    ">
                    Verify Email
                  </a>
                </div>

                <p>If the button above does not work, copy and paste this link into your browser:</p>

                <p style="word-break:break-all;">
                  <a href="${verificationLink}" style="color:#1a73e8;text-decoration:none;">
                    ${verificationLink}
                  </a>
                </p>

                <!-- Expiry Box -->
                <div style="
                    background:#f8f9fa;
                    padding:15px;
                    border-left:4px solid #ff9800;
                    border-radius:8px;
                    margin:20px 0;
                    color:#555;
                  ">
                  <strong>⏳ This link expires in ${expiryHours} hours.</strong>
                </div>

                <!-- Security Note -->
                <div style="
                    background:#fff8e1;
                    padding:15px;
                    border-left:4px solid #ffc107;
                    border-radius:8px;
                    margin-top:15px;
                    font-size:14px;
                    color:#555;
                  ">
                  <strong>🔐 Security Notice:</strong>  
                  If you did not sign up for Medixa, please ignore this email.
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" 
                style="padding:25px;color:#777;font-size:13px;border-top:1px solid #eee;">
                
                Need help? Contact our support team  
                <br>
                <a href="mailto:support@medixa.com" style="color:#1a73e8;text-decoration:none;">
                  support@medixa.com
                </a>
                <br><br>
                <span style="font-size:12px;color:#aaa;">
                  © ${new Date().getFullYear()} Medixa Hospital System.  
                  All rights reserved.
                </span>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
    `,
    text: `
Hello ${userName || 'User'},

Please verify your email to activate your Medixa account.

Verification link:
${verificationLink}

This link expires in ${expiryHours} hours.

If you did not create this account, ignore this message.

Support: support@medixa.com
© ${new Date().getFullYear()} Medixa Hospital System
    `,
  }),

  // Welcome Email (After Verification)
  welcomeEmail: (userName: string) => ({
    subject: 'Welcome to Medixa - Account Successfully Verified!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Medixa</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
          .greeting { font-size: 28px; margin-bottom: 20px; color: #2E7D32; text-align: center; }
          .success-icon { text-align: center; font-size: 60px; margin: 20px 0; }
          .message { font-size: 16px; margin-bottom: 25px; color: #555; }
          .features { margin: 30px 0; }
          .feature { display: flex; align-items: center; margin: 15px 0; }
          .feature-icon { font-size: 24px; margin-right: 15px; }
          .cta-buttons { text-align: center; margin: 40px 0; }
          .cta-button { display: inline-block; background: #4CAF50; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; margin: 0 10px; font-weight: 600; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎉 Welcome to Medixa!</div>
            <div>Your account is now fully activated</div>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            <h1 class="greeting">Welcome aboard, ${userName}!</h1>
            
            <p class="message">
              Your email has been successfully verified! You now have full access to 
              all features of the Medixa Hospital Management System.
            </p>
            
            <div class="features">
              <div class="feature">
                <span class="feature-icon">📋</span>
                <span>Manage patient records and appointments</span>
              </div>
              <div class="feature">
                <span class="feature-icon">💊</span>
                <span>Track medications and prescriptions</span>
              </div>
              <div class="feature">
                <span class="feature-icon">📊</span>
                <span>Generate reports and analytics</span>
              </div>
              <div class="feature">
                <span class="feature-icon">👥</span>
                <span>Collaborate with medical staff</span>
              </div>
            </div>
            
            <div class="cta-buttons">
              <a href="${config.origin}/dashboard" class="cta-button">Go to Dashboard</a>
              <a href="${config.origin}/profile" class="cta-button" style="background: #2196F3;">Complete Profile</a>
            </div>
            
            <div class="footer">
              <p>Need help getting started? Check out our <a href="${config.origin}/help">Getting Started Guide</a></p>
              <p style="margin-top: 20px; color: #999; font-size: 12px;">
                Happy to serve you,<br>
                The Medixa Team
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Forgot Password Template (similar to reset but for initiating)
  passwordResetOtp: (userName: string, otpCode: string, expiryMinutes = 10) => ({
    subject: 'Your Password Reset OTP - Medixa Hospital System',
    html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
      <tr>
        <td align="center">

          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
            style="background:#ffffff;border-radius:10px;overflow:hidden;
                   box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td align="center" 
                style="background:linear-gradient(135deg,#1a73e8,#0d47a1);
                       padding:35px 20px;color:#ffffff;">
                <h1 style="margin:0;font-size:26px;font-weight:700;">Verification Code</h1>
                <p style="margin:5px 0 0;font-size:14px;opacity:.9;">
                  Medixa Hospital System
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 35px;color:#333333;font-size:16px;line-height:1.6;">

                <h2 style="margin-top:0;font-size:22px;font-weight:600;">
                  Hello ${userName || 'User'},
                </h2>

                <p>
                  We received a request to reset your password for your
                  <strong>Medixa Hospital System</strong> account. 
                  Please use the following 6-digit One-Time Password (OTP) to complete the process:
                </p>

                <div style="text-align:center;margin:35px 0;">
                  <div style="
                      display:inline-block;
                      background:#f0f7ff;
                      border: 2px dashed #1a73e8;
                      color:#1a73e8;
                      padding:20px 45px;
                      font-size:32px;
                      letter-spacing: 8px;
                      border-radius:12px;
                      font-weight:bold;
                      font-family: 'Courier New', Courier, monospace;
                    ">
                    ${otpCode}
                  </div>
                  <p style="font-size:12px;color:#777;margin-top:10px;">
                    (This code is valid for one-time use only)
                  </p>
                </div>

                <div style="
                    background:#f8f9fa;
                    padding:15px;
                    border-left:4px solid #ff9800;
                    border-radius:8px;
                    margin:20px 0;
                    color:#555;
                  ">
                  <strong>⏳ This code expires in ${expiryMinutes} minutes.</strong>
                </div>

                <div style="
                    background:#fff8e1;
                    padding:15px;
                    border-left:4px solid #ffc107;
                    border-radius:8px;
                    margin-top:15px;
                    font-size:14px;
                    color:#555;
                  ">
                  <strong>⚠️ Security Notice:</strong>  
                  Never share this OTP with anyone, including Medixa staff. 
                  If you did not request this, please ignore this email.
                </div>

              </td>
            </tr>

            <tr>
              <td align="center"
                style="padding:25px;color:#777;font-size:13px;border-top:1px solid #eee;">
                
                Need help? Contact support  
                <br>
                <a href="mailto:support@medixa.com" style="color:#1a73e8;text-decoration:none;">
                  support@medixa.com
                </a>

                <br><br>
                <span style="font-size:12px;color:#aaa;">
                  © ${new Date().getFullYear()} Medixa Hospital System.  
                  All rights reserved.
                </span>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
    `,
    text: `
Hello ${userName || 'User'},

Your Medixa Hospital System password reset OTP is: ${otpCode}

This code expires in ${expiryMinutes} minutes.

If you did not request a password reset, please ignore this email.

Support: support@medixa.com
© ${new Date().getFullYear()} Medixa Hospital System
    `,
  }),
};
