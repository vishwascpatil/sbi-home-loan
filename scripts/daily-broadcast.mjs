import { setVapidDetails, sendNotification } from 'web-push';
import { WOW_STATEMENTS } from './broadcast-wow-runner.mjs';

const PROJECT_ID = 'loan-emi-tracker-61c10';
const PRIMARY_LOAN_ID = 'loan-primary';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BOszAne7k25hJNMQtwmE-kXuDhNgmyKpePhwCsk_3xZvJa1kgFIiP2lVtlIK127Q837t164rWc8eQ-C06lvHY3Y';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'RfzSC4biNRFEkPHoQB5fm73huUNO6xSI8NaCJve5B0I';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:vishwascpatilonline@gmail.com';

const FAST2SMS_API_KEY =
  process.env.FAST2SMS_API_KEY ||
  'ifP2O75vmoqxcxZ4L7XvQTDUhQBYEz9upwlR69z7nDIRaM0mD0Ne7S9IZd8R3YTpGzOkJhtoOCUK0my2';

const FAMILY_MEMBERS = [
  { name: 'Vishwas', phone: '8105242578' },
  { name: 'Vikas', phone: '9880413201' },
  { name: 'Bhavya', phone: '9902103979' },
  { name: 'CSP', phone: '9880404025' },
  { name: 'Shruthi', phone: '9844586757' },
];

function formatRupees(paise) {
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  let formatted = rupees.toLocaleString('en-IN');
  if (remainder > 0) {
    formatted += '.' + remainder.toString().padStart(2, '0');
  }
  return formatted;
}

async function runDailyBroadcast() {
  console.log('====================================================');
  console.log('🚀 Starting SBI Home Loan Daily 9:00 AM IST Broadcast');
  console.log('Timestamp:', new Date().toISOString());
  console.log('====================================================\n');

  // 1. Fetch Loan Details
  let principalPaise = 1188628900; // ₹1,18,86,289 authentic book outstanding
  let sanctionedPaise = 1261293000; // ₹1,26,12,930 drawing limit
  let initialDisbursedPaise = 1330000000; // ₹1,33,00,000 initial loan
  let rateBps = 790; // 7.90% default

  try {
    const loanRes = await fetch(`${FIRESTORE_BASE}/loans/${PRIMARY_LOAN_ID}`);
    if (loanRes.ok) {
      const loanDoc = await loanRes.json();
      const f = loanDoc.fields || {};
      if (f.openingOutstanding?.integerValue) {
        principalPaise = Number(f.openingOutstanding.integerValue);
      }
      if (f.sanctionedLimit?.integerValue) {
        sanctionedPaise = Number(f.sanctionedLimit.integerValue);
      }
      if (f.currentRateBps?.integerValue) {
        rateBps = Number(f.currentRateBps.integerValue);
      }
      console.log('✓ Successfully loaded loan parameters from Cloud Firestore.');
    } else {
      console.warn('⚠️ Could not load loan document from Firestore, using baseline state.');
    }
  } catch (err) {
    console.warn('⚠️ Firestore fetch error, using default parameters:', err.message);
  }

  // 2. Compute Daily Interest & OD Shield Metrics (SBI OD actual/365 reducing balance)
  const dailyInterestPaise = Math.round((principalPaise * (rateBps / 10000)) / 365);
  const updatedOutstandingPaise = principalPaise + dailyInterestPaise;
  const odBufferPaise = Math.max(0, sanctionedPaise - principalPaise);
  const dailyOdSavingsPaise = Math.round((odBufferPaise * (rateBps / 10000)) / 365);
  const clearedPaise = Math.max(0, initialDisbursedPaise - principalPaise);
  const clearedPct = ((clearedPaise / initialDisbursedPaise) * 100).toFixed(1);

  const dailyIntStr = formatRupees(dailyInterestPaise);
  const totalOutStr = formatRupees(updatedOutstandingPaise);
  const odBufferStr = formatRupees(odBufferPaise);
  const odSavingsStr = formatRupees(dailyOdSavingsPaise);
  const ratePctStr = (rateBps / 100).toFixed(2);

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  console.log(`📊 Date: ${dateStr}`);
  console.log(`💰 Outstanding Debt: ₹${formatRupees(principalPaise)} (${clearedPct}% paid down)`);
  console.log(`🛡️ OD Surplus Buffer: ₹${odBufferStr} (Saves +₹${odSavingsStr}/day)`);
  console.log(`📈 Rate: ${ratePctStr}% p.a.`);
  console.log(`⚡ Daily Interest Accrued: +₹${dailyIntStr}`);
  console.log(`🏦 New Total Loan Balance: ₹${totalOutStr}\n`);

  const todayWow = WOW_STATEMENTS[new Date().getDate() % WOW_STATEMENTS.length];
  console.log(`💬 Today's Featured WOW Statement (#${todayWow.id}): "${todayWow.title}"`);

  // =========================================================================
  // STEP 3: Dispatch Web Push Notifications to all Registered Apple / Web Devices
  // =========================================================================
  console.log('--- [Step 1] Dispatching Lock-Screen Web Push Notifications ---');
  setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const subRes = await fetch(`${FIRESTORE_BASE}/loans/${PRIMARY_LOAN_ID}/push_subscriptions`);
    if (subRes.ok) {
      const subData = await subRes.json();
      const docs = subData.documents || [];
      console.log(`Found ${docs.length} active device push subscription(s).`);

      const payload = JSON.stringify({
        notification: {
          title: todayWow.title,
          body: `${todayWow.body} (Debt: ₹${formatRupees(principalPaise)} | OD Buffer: ₹${odBufferStr})`,
          icon: '/sbi-home-loan/icons/icon-192x192.png',
          badge: '/sbi-home-loan/icons/icon-72x72.png',
          data: {
            onActionClick: {
              default: { operation: 'openWindow', url: '/sbi-home-loan/' },
            },
          },
        },
      });

      for (const doc of docs) {
        const fields = doc.fields || {};
        const endpoint = fields.endpoint?.stringValue;
        const p256dh = fields.keys?.mapValue?.fields?.p256dh?.stringValue;
        const auth = fields.keys?.mapValue?.fields?.auth?.stringValue;
        const phone = fields.phone?.stringValue || 'N/A';
        const platform = fields.platform?.stringValue || 'Web';

        if (endpoint && p256dh && auth) {
          try {
            const pushResult = await sendNotification(
              { endpoint, keys: { p256dh, auth } },
              payload
            );
            console.log(`✓ Web Push delivered to ${platform} device (${phone}): Status ${pushResult.statusCode}`);
          } catch (pushErr) {
            console.warn(`⚠️ Failed to deliver Web Push to ${phone}:`, pushErr.message);
          }
        }
      }
    } else {
      console.log('No push subscriptions collection found in Firestore.');
    }
  } catch (err) {
    console.error('Error fetching push subscriptions:', err.message);
  }

  // =========================================================================
  // STEP 4: Dispatch Carrier SMS via Fast2SMS
  // =========================================================================
  console.log('\n--- [Step 2] Dispatching Carrier SMS via Fast2SMS ---');
  const smsMessage =
    `${todayWow.title}\n` +
    `SBI Maxgain: Debt ₹${formatRupees(principalPaise)} (${clearedPct}% cleared). ` +
    `OD Buffer: ₹${odBufferStr} saves Rs ${odSavingsStr}/day. ` +
    `Live: https://vishwascpatil.github.io/sbi-home-loan/`;

  console.log('SMS Message Payload:');
  console.log(smsMessage);
  console.log('Length:', smsMessage.length, 'chars\n');

  if (FAST2SMS_API_KEY) {
    for (const member of FAMILY_MEMBERS) {
      try {
        console.log(`Sending SMS to ${member.name} (${member.phone})...`);
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: smsMessage,
            flash: 0,
            numbers: member.phone,
          }),
        });

        const smsData = await smsRes.json();
        if (smsData && smsData.return === true) {
          console.log(`✓ SMS dispatched to ${member.name} (+91${member.phone})! Request ID: ${smsData.request_id || 'OK'}`);
        } else {
          console.warn(`⚠️ Fast2SMS response for ${member.name}:`, smsData.message || JSON.stringify(smsData));
        }
      } catch (err) {
        console.error(`Error sending SMS to ${member.phone}:`, err.message);
      }
    }
  } else {
    console.log('No FAST2SMS_API_KEY provided. Skipping SMS dispatch.');
  }

  console.log('\n====================================================');
  console.log('✓ Daily 9:00 AM IST Broadcast Routine Completed!');
  console.log('====================================================');
}

runDailyBroadcast().catch((err) => {
  console.error('Fatal broadcast error:', err);
  process.exit(1);
});
