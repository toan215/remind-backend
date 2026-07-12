import nodemailer from 'nodemailer';

export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Gửi email sử dụng Nodemailer (service: gmail)
 * Nếu thiếu cấu hình biến môi trường EMAIL_USER hoặc EMAIL_PASS,
 * hệ thống sẽ log nội dung email ra console để phục vụ phát triển/kiểm thử.
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<{ success: boolean; messageId?: string }> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.warn('⚠️ EMAIL_USER hoặc EMAIL_PASS chưa được định nghĩa trong biến môi trường.');
    console.log('--- MÔ PHỎNG GỬI EMAIL (DEVELOPMENT MODE) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (HTML):\n${html}`);
    console.log('---------------------------------------------');
    return { success: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const mailOptions = {
    from: `"ReMind AI" <${emailUser}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}
