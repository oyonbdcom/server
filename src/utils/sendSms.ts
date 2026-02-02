import config from '../config/config';

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Sends an SMS using the BulkSMSBD API.
 * @param number - Recipient's phone number
 * @param message - The content of the SMS
 */
export const sendSMS = async (number: string | number, message: string): Promise<SMSResponse> => {
  const { sms_api_key: apiKey, sender_id: defaultSenderId } = config.sms;
  const baseUrl = 'http://bulksmsbd.net/api/smsapi';

  try {
    // ১. কুয়েরি প্যারামিটার তৈরি (এটি অটোমেটিক encodeURIComponent হ্যান্ডেল করে)
    const params = new URLSearchParams({
      api_key: apiKey!,
      type: 'text',
      number: String(number),
      senderid: defaultSenderId || '8801894844452',
      message: message,
    });

    // ২. রিকোয়েস্ট পাঠানো
    const response = await fetch(`${baseUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log({ data });
    // ৩. API রেসপন্স কোড চেক করা (BulkSMSBD সাধারণত ২০২ কোড দেয় সফল হলে)
    if (data.response_code === 202) {
      return {
        success: true,
        message: data.success_message || 'SMS sent successfully.',
      };
    }

    return {
      success: false,
      error: data.error_message || 'Failed to send SMS.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    console.log('SMS_SERVICE_ERROR:', errorMessage);

    return {
      success: false,
      error: 'সার্ভারে নেটওয়ার্ক জনিত সমস্যা হচ্ছে।',
    };
  }
};
