import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';

admin.initializeApp();
const db = admin.firestore();

const PRIMARY_LOAN_ID = 'loan-primary';

// The 5 Family Co-borrowers
const FAMILY_MEMBERS = [
  { name: 'Vishwas', phone: '+918105242578', email: 'vishwascpatilonline@gmail.com', target: 105000 },
  { name: 'Vikas', phone: '+919880413201', email: 'vikascpatil123@gmail.com', target: 105000 },
  { name: 'Bhavya', phone: '+919902103979', email: '', target: 10000 },
  { name: 'CSP', phone: '+919880404025', email: '', target: 10000 },
  { name: 'Shruthi', phone: '+919844586757', email: '', target: 10000 },
];

/**
 * 1. DAILY AT 9:00 AM IST
 * Informs the 5 members that today x amount is added as interest
 * and it grew the outstanding amount to x outstanding amount + interest per day.
 * Cron expression: '0 9 * * *', timeZone: 'Asia/Kolkata'
 */
export const dailyInterestBroadcast = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    logger.info('Executing daily 9:00 AM interest calculation and broadcast...');

    const loanDoc = await db.doc(`loans/${PRIMARY_LOAN_ID}`).get();
    if (!loanDoc.exists) {
      logger.error('Primary loan document not found!');
      return;
    }

    const loan = loanDoc.data()!;
    const openingOutstandingPaise = Number(loan.openingOutstanding || 1205518900);
    const rateBps = Number(loan.currentRateBps || 790);

    // SBI OD Daily Reducing Balance Formula: (P * R) / 365
    const dailyInterestPaise = Math.round((openingOutstandingPaise * (rateBps / 10000)) / 365);
    const updatedOutstandingPaise = openingOutstandingPaise + dailyInterestPaise;

    const dailyInterestRs = (dailyInterestPaise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });
    const updatedOutstandingRs = (updatedOutstandingPaise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const notificationMessage =
      `🏦 SBI Home Loan Daily Update (${dateStr}):\n` +
      `Today's interest added: +₹${dailyInterestRs}\n` +
      `New loan outstanding balance: ₹${updatedOutstandingRs}\n` +
      `Current Rate: ${(rateBps / 100).toFixed(2)}% p.a.\n` +
      `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`;

    logger.info('Broadcast Message Generated:\n' + notificationMessage);

    // Dispatch to all 5 member phone numbers
    for (const member of FAMILY_MEMBERS) {
      await dispatchMessage(member.phone, notificationMessage);
    }
  }
);

/**
 * 2. EVERY 1ST OF THE MONTH AT 9:00 AM IST
 * Short mobile reminder for all 5 members: payment is due, how much they should pay.
 * Cron expression: '0 9 1 * *', timeZone: 'Asia/Kolkata'
 */
export const monthlyPaymentReminder = onSchedule(
  {
    schedule: '0 9 1 * *',
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    const curMonth = new Date().toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    logger.info(`Executing 1st of month payment due reminder for ${curMonth}...`);

    for (const member of FAMILY_MEMBERS) {
      const targetRs = member.target.toLocaleString('en-IN');
      const reminderText =
        `🔔 EMI Due Reminder: Hi ${member.name}, your ${curMonth} share of ₹${targetRs} ` +
        `is due by the 5th for your SBI Home Loan. Please deposit to A/C 43054757071. ` +
        `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`;

      await dispatchMessage(member.phone, reminderText);
    }
  }
);

/**
 * 3. EVERY 1ST OF NOVEMBER AT 9:00 AM IST
 * Sends email to members maintaining an Excel sheet of who paid how much
 * and keeping track of all numbers.
 * Cron expression: '0 9 1 11 *', timeZone: 'Asia/Kolkata'
 */
export const annualNovemberExcelReport = onSchedule(
  {
    schedule: '0 9 1 11 *',
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    logger.info('Executing annual November 1st Excel generation and email report...');

    // 1. Fetch transactions from Firestore
    const txSnap = await db.collection(`loans/${PRIMARY_LOAN_ID}/transactions`).get();
    const transactions = txSnap.docs.map((d) => d.data());

    // 2. Fetch loan details
    const loanDoc = await db.doc(`loans/${PRIMARY_LOAN_ID}`).get();
    const loan = loanDoc.data() || {};

    // 3. Compute Member Totals
    const memberSummaryData = FAMILY_MEMBERS.map((member) => {
      const memberTx = transactions.filter(
        (t) => !t.deletedAt && t.type === 'contribution' && t.notes?.includes(member.name)
      );
      const totalPaidPaise = memberTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const totalPaidRs = totalPaidPaise / 100;
      const annualTargetRs = member.target * 12;

      return {
        'Member Name': member.name,
        'Phone Number': member.phone,
        'Email': member.email || 'N/A',
        'Monthly Target (₹)': member.target,
        'Annual Target (₹)': annualTargetRs,
        'Total Paid This Year (₹)': totalPaidRs,
        'Target Met (%)': Math.min(100, Math.round((totalPaidRs / annualTargetRs) * 100)) + '%',
      };
    });

    const txRowsData = transactions
      .filter((t) => !t.deletedAt)
      .map((t) => ({
        Date: t.date || '-',
        'For Month': t.forMonth || '-',
        Type: t.type || '-',
        'Amount (₹)': Number(t.amount || 0) / 100,
        Mode: t.mode || 'UPI',
        Reference: t.reference || '-',
        Notes: t.notes || '-',
      }));

    // 4. Create multi-sheet Excel Workbook with SheetJS
    const workbook = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(memberSummaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Member Contributions');

    const wsTx = XLSX.utils.json_to_sheet(txRowsData);
    XLSX.utils.book_append_sheet(workbook, wsTx, 'All Transactions');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 5. Send Email with attached Excel File
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'vishwascpatilonline@gmail.com',
        pass: process.env.EMAIL_PASS || '',
      },
    });

    const emailRecipients = ['vishwascpatilonline@gmail.com', 'vikascpatil123@gmail.com'];

    const mailOptions = {
      from: '"SBI Home Loan Tracker" <no-reply@loan-tracker.com>',
      to: emailRecipients,
      subject: `SBI Home Loan - Annual Payment Report & Excel Ledger (Nov 1st ${new Date().getFullYear()})`,
      text:
        `Dear Family Members,\n\n` +
        `Please find attached the complete Annual Excel Ledger and payment breakdown for our SBI Home Loan Overdraft (A/C: ${loan.accountNumber || '43054757071'}).\n\n` +
        `This Excel workbook contains:\n` +
        `1. Member-wise annual contributions and target fulfillment.\n` +
        `2. Full ledger transaction history with dates, amounts, and modes.\n\n` +
        `Live Tracker: https://vishwascpatil.github.io/sbi-home-loan/\n\n` +
        `Regards,\nHome Loan EMI Tracker`,
      attachments: [
        {
          filename: `SBI_Home_Loan_Annual_Report_Nov_${new Date().getFullYear()}.xlsx`,
          content: excelBuffer,
        },
      ],
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info('Annual November email report sent successfully to ' + emailRecipients.join(', '));
    } catch (err) {
      logger.error('Failed to send email report via transporter:', err);
    }
  }
);

/**
 * Helper to dispatch SMS notifications via Fast2SMS or Twilio.
 * Reads API key from Firestore settings (/loans/loan-primary/settings/sms_gateway) or environment.
 */
async function dispatchMessage(phone: string, text: string): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '').replace(/^91/, '');
  logger.info(`[Dispatch] Sending SMS to ${cleanPhone}:`);
  logger.info(text);

  try {
    const cfgSnap = await db.doc(`loans/${PRIMARY_LOAN_ID}/settings/sms_gateway`).get();
    const config = cfgSnap.exists ? cfgSnap.data() : {};
    const fast2smsKey =
      process.env.FAST2SMS_API_KEY ||
      config?.fast2smsApiKey ||
      'ifP2O75vmoqxcxZ4L7XvQTDUhQBYEz9upwlR69z7nDIRaM0mD0Ne7S9IZd8R3YTpGzOkJhtoOCUK0my2';

    if (fast2smsKey) {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2smsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: text,
          flash: 0,
          numbers: cleanPhone,
        }),
      });
      const resData = await response.json();
      logger.info(`[Fast2SMS] Response for ${cleanPhone}:`, resData);
      return;
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID || config?.twilioAccountSid;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN || config?.twilioAuthToken;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER || config?.twilioFromNumber;

    if (twilioSid && twilioToken && twilioFrom) {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: `+91${cleanPhone}`,
        From: twilioFrom,
        Body: text,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        }
      );
      const resData = await response.json();
      logger.info(`[Twilio] Response for ${cleanPhone}:`, resData);
      return;
    }

    logger.info(`[Dispatch] No active SMS gateway configured. Message logged above.`);
  } catch (err) {
    logger.error(`[Dispatch] Error delivering SMS to ${cleanPhone}:`, err);
  }
}


