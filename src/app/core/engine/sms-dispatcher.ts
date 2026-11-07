import { formatPaise, Paise } from './money';
import { LedgerState } from './models';
import { computeDailyInterest } from './broadcast';
import { outstandingAt } from './ledger';

export interface SmsGatewayConfig {
  provider: 'fast2sms' | 'twilio' | 'customWebhook';
  fast2smsApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  customWebhookUrl?: string;
}

export interface SmsDispatchResult {
  success: boolean;
  message: string;
  provider: string;
  requestId?: string;
  error?: string;
  timestamp: string;
}

const SMS_CONFIG_STORAGE_KEY = 'loan_tracker_sms_config_v1';

export const DEFAULT_FAST2SMS_KEY =
  'ifP2O75vmoqxcxZ4L7XvQTDUhQBYEz9upwlR69z7nDIRaM0mD0Ne7S9IZd8R3YTpGzOkJhtoOCUK0my2';

export function loadLocalSmsConfig(): SmsGatewayConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SMS_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.fast2smsApiKey) {
          parsed.fast2smsApiKey = DEFAULT_FAST2SMS_KEY;
        }
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  return {
    provider: 'fast2sms',
    fast2smsApiKey: DEFAULT_FAST2SMS_KEY,
  };
}

export function saveLocalSmsConfig(config: SmsGatewayConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SMS_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore quota issues
  }
}

/**
 * Builds crisp SMS body under 160 chars for fast delivery.
 */
export function buildDailyInterestSms(
  state: LedgerState,
  dateIso: string = new Date().toISOString().slice(0, 10)
): string {
  const principal = outstandingAt(dateIso, state);
  const basisDays = state.loan.bankRules?.dayCountBasis === '360' ? 360 : 365;
  const dailyInt = computeDailyInterest(principal, state.loan.currentRateBps, basisDays);
  const newBalance = (principal + dailyInt) as Paise;

  return (
    `SBI Home Loan Update: Today's interest +${formatPaise(dailyInt)}. ` +
    `Outstanding: ${formatPaise(newBalance)}. ` +
    `Rate: ${(state.loan.currentRateBps / 100).toFixed(2)}% p.a. ` +
    `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`
  );
}

export function buildMonthlyDueSms(
  memberName: string,
  duePaise: Paise,
  accountNumber: string
): string {
  const curMonth = new Date().toLocaleDateString('en-IN', { month: 'short' });
  return (
    `SBI Home Loan Due: Hi ${memberName}, your ${curMonth} share of ${formatPaise(duePaise)} ` +
    `is due by 5th. Deposit to SBI OD A/C ${accountNumber}. ` +
    `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`
  );
}

/**
 * Dispatches live SMS using the configured gateway (Fast2SMS or Twilio).
 */
export async function dispatchSms(
  toPhone: string,
  message: string,
  config: SmsGatewayConfig
): Promise<SmsDispatchResult> {
  const cleanPhone = toPhone.replace(/\D/g, '').replace(/^91/, '');
  const timestamp = new Date().toISOString();

  if (!cleanPhone || cleanPhone.length !== 10) {
    return {
      success: false,
      provider: config.provider,
      message: `Invalid 10-digit Indian phone number: ${toPhone}`,
      timestamp,
    };
  }

  if (config.provider === 'fast2sms') {
    const apiKey = config.fast2smsApiKey?.trim();
    if (!apiKey) {
      return {
        success: false,
        provider: 'fast2sms',
        message:
          'Fast2SMS API Key is required. Please paste your Fast2SMS API key in Settings → SMS Gateway.',
        timestamp,
      };
    }

    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: message,
          flash: 0,
          numbers: cleanPhone,
        }),
      });

      const data = await response.json();

      if (data && data.return === true) {
        return {
          success: true,
          provider: 'fast2sms',
          message: `SMS dispatched successfully to +91${cleanPhone}! (Fast2SMS Request: ${data.request_id || 'OK'})`,
          requestId: data.request_id,
          timestamp,
        };
      } else {
        const errorMsg =
          Array.isArray(data.message) && data.message.length > 0
            ? data.message.join(', ')
            : data.message || 'SMS dispatch rejected by Fast2SMS';
        return {
          success: false,
          provider: 'fast2sms',
          message: `Fast2SMS Error: ${errorMsg}`,
          error: errorMsg,
          timestamp,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: 'fast2sms',
        message: `Network or CORS error connecting to Fast2SMS: ${errMsg}`,
        error: errMsg,
        timestamp,
      };
    }
  }

  if (config.provider === 'twilio') {
    const sid = config.twilioAccountSid?.trim();
    const token = config.twilioAuthToken?.trim();
    const from = config.twilioFromNumber?.trim();

    if (!sid || !token || !from) {
      return {
        success: false,
        provider: 'twilio',
        message: 'Twilio Account SID, Auth Token, and From Number are required.',
        timestamp,
      };
    }

    try {
      const auth = btoa(`${sid}:${token}`);
      const bodyParams = new URLSearchParams({
        To: `+91${cleanPhone}`,
        From: from,
        Body: message,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        }
      );

      const data = await response.json();

      if (response.ok && data.sid) {
        return {
          success: true,
          provider: 'twilio',
          message: `Twilio SMS delivered to +91${cleanPhone}! (SID: ${data.sid})`,
          requestId: data.sid,
          timestamp,
        };
      } else {
        return {
          success: false,
          provider: 'twilio',
          message: `Twilio error: ${data.message || 'Delivery failed'}`,
          error: data.message,
          timestamp,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: 'twilio',
        message: `Twilio connection error: ${errMsg}`,
        error: errMsg,
        timestamp,
      };
    }
  }

  return {
    success: false,
    provider: config.provider,
    message: `Unsupported SMS provider: ${config.provider}`,
    timestamp,
  };
}
