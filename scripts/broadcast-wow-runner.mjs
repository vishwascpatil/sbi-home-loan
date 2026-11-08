#!/usr/bin/env node

/**
 * SBI Home Loan Tracker - 5-Minute WOW Statements Push & SMS Runner
 *
 * Dispatches funny & high-impact push notifications and SMS to the 5 family members:
 * 1. Vishwas (8105242578)
 * 2. Vikas   (9880413201)
 * 3. Bhavya  (9902103979)
 * 4. CSP     (9880404025)
 * 5. Shruthi (9844586757)
 *
 * Usage:
 *   node scripts/broadcast-wow-runner.mjs --once              (Fire single round-robin statement)
 *   node scripts/broadcast-wow-runner.mjs --interval=5        (Run continuous loop every 5 mins)
 *   node scripts/broadcast-wow-runner.mjs --interval=1        (Run loop every 1 minute)
 *   node scripts/broadcast-wow-runner.mjs --index=5           (Send specific statement ID 1..20)
 *   node scripts/broadcast-wow-runner.mjs --phone=8105242578  (Test send to single phone number)
 */

import { setVapidDetails, sendNotification } from 'web-push';

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

export const TARGET_FAMILY = [
  { name: 'Vishwas', phone: '8105242578', role: 'Heavyweight (₹1.05L)' },
  { name: 'Vikas', phone: '9880413201', role: 'Heavyweight (₹1.05L)' },
  { name: 'Bhavya', phone: '9902103979', role: 'Precision Sniper (₹10K)' },
  { name: 'CSP', phone: '9880404025', role: 'Captain (₹10K)' },
  { name: 'Shruthi', phone: '9844586757', role: 'Precision Sniper (₹10K)' },
];

export const WOW_STATEMENTS = [
  {
    id: 1,
    title: '🧟‍♂️ SBI Interest Is Awake (Are You?)',
    body: "While you were peacefully sleeping, SBI quietly added ₹2,570 to your loan. Every rupee in the Maxgain OD account stops this vampire immediately. Don't let the bank eat your breakfast!",
    shortSms: "SBI added ₹2,570 interest while you slept! Deposit to Maxgain OD 43054757071 to stop daily bleed: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 2,
    title: '🛑 Dinesh Khara (SBI Chairman) Just Smiled',
    body: "Someone delayed their transfer and SBI earned another ₹100 today. Transfer your monthly share to A/C 43054757071 right now and wipe that smile off their face!",
    shortSms: "SBI earned interest on delayed transfer! Transfer share to A/C 43054757071 now to protect family savings: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 3,
    title: '⚖️ Your ₹1.18 Cr Debt Is On A Crash Diet',
    body: "Loan balance just checked the weighing scale: still ₹1,18,86,289. Feed the Maxgain account today — let’s put this stubborn loan on an extreme calorie deficit!",
    shortSms: "Loan balance: ₹1.18 Cr. Put this debt on an extreme calorie deficit by parking funds in OD: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 4,
    title: '🥷 Maxgain OD Shield Activated!',
    body: "Your surplus balance blocked SBI from charging ₹780 in daily interest yesterday. That’s 2 large Domino’s pizzas saved pure from the bank’s jaws. Keep that money parked!",
    shortSms: "OD Shield saved ₹780 daily interest yesterday! That is pure money saved from SBI. Keep funds parked: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 5,
    title: '👑 Vishwas vs Vikas: Heavyweight Title Match',
    body: "The ₹1,05,000 clash of titans is live! Rumour has it whoever transfers first this month gets family crown rights and is exempt from washing dinner dishes for a week.",
    shortSms: "Vishwas vs Vikas ₹1.05L race is on! First to transfer to OD gets family bragging rights this month: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 6,
    title: '💼 Vikas: Your ₹1.05L Bazooka Is Summoned',
    body: "The tracker detects immense power in your account. Direct ₹1.05 Lakhs to the OD bunker and vaporize 45 days of interest in one single strike!",
    shortSms: "Vikas: Load your ₹1.05L target into Maxgain OD and vaporize 45 days of SBI interest in 1 shot: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 7,
    title: '🚀 Vishwas: Deploy The ₹1.05L Rocket',
    body: "SBI thought they had this family locked in for 20 years. Vishwas said 'Hold my chai' and loaded ₹1,05,000 into the OD launcher. Ready to press Fire?",
    shortSms: "Vishwas: Deploy your ₹1.05L rocket to SBI Maxgain OD A/C 43054757071 and accelerate freedom: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 8,
    title: '💥 The 2-Lakh Power Punch',
    body: "When Vishwas and Vikas drop ₹1.05L each on the same day, SBI’s loan amortization engine literally starts sweating. Hit the button and show them who owns this house!",
    shortSms: "The ₹2.10L power punch by Vishwas & Vikas makes SBI amortization sweat. Clear dues by 5th: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 9,
    title: '🎯 The ₹10,000 Silent Assassin Alert',
    body: "CSP, Bhavya & Shruthi: Your ₹10,000 might look sweet, but in a Maxgain OD it slices through compound interest like a samurai sword. Lock, load, and fire!",
    shortSms: "CSP, Bhavya & Shruthi: Your ₹10k monthly share slices through compound interest like a samurai sword: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 10,
    title: '🎖️ Captain CSP Calling The Troops',
    body: "'Beta, loan interest waits for no one.' CSP’s ₹10,000 target is locked in. Let’s lead the family to complete mortgage freedom by 2028!",
    shortSms: "Captain CSP reminder: Loan interest waits for no one! Transfer ₹10k to OD A/C 43054757071: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 11,
    title: '🛍️ Bhavya: Outsmart SBI Today',
    body: "Cancel one online shopping cart session, drop ₹10,000 into the OD account, and watch your family equity bar turn radiant emerald green. Pure instant dopamine!",
    shortSms: "Bhavya: Transfer your ₹10,000 monthly share to Maxgain OD and watch family progress hit 100%: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 12,
    title: '🔮 Shruthi: ₹10K vs SBI Monopoly',
    body: "₹10,000 deposited today permanently deletes ~₹790 in annual interest forever. That’s a higher guaranteed return than the stock market. Send it in!",
    shortSms: "Shruthi: ₹10,000 in Maxgain OD permanently saves ₹790/yr in interest forever. Deposit today: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 13,
    title: '🚨 5th of the Month Emergency Protocol!',
    body: "Clock is ticking down to the 5th! The family pool target is ₹2,40,000. If we hit 100%, we save ₹4.8 Lakhs in future interest. Don't be the one on the 'Pending' list!",
    shortSms: "5th of the month reminder! Monthly target is ₹2,40,000. Deposit by 5th to save ₹4.8L future interest: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 14,
    title: '🌟 Tracker Status: 5/5 Stars or Red Alert?',
    body: "Open the live tracker right now: vishwascpatil.github.io/sbi-home-loan/. Green badges are waiting for your name. Claim yours before midnight!",
    shortSms: "Tracker check: Are all 5 stars green? View live status & log payment: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 15,
    title: '🏖️ The ₹2.40 Lakh Club Is Assembling',
    body: "₹2,40,000 per month turns a 20-year sentence into a 4.5-year speedrun. Check your target, clear your dues, and start booking your early retirement holiday!",
    shortSms: "₹2.40L/month turns a 20-yr loan into a 4.5-yr speedrun! Check your target and clear dues: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 16,
    title: '🤖 Bank Alert: Did They Just Pay Early?!',
    body: "SBI systems get visibly confused when everyone pays by the 3rd instead of the 5th. Let’s break their algorithm this month.",
    shortSms: "Pay by the 3rd instead of 5th and confuse SBI's algorithm with zero interest bleed: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 17,
    title: '🍗 Biryani vs Home Loan Principal',
    body: "That weekend dinner was ₹1,800. In Maxgain OD, ₹1,800 saves ₹142 every year in interest. We’re not saying don’t eat... but living debt-free tastes much better!",
    shortSms: "Food for thought: ₹1,800 in Maxgain OD saves ₹142/yr in interest forever. Feed the house first: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 18,
    title: '🕶️ Relatives: Aur beta, loan kab khatam hoga?',
    body: "Next time Sharma Uncle asks about the house, show him the Debt-Free countdown: '4 years, uncle, thanks to our Maxgain OD tracker!' Shut them down with cold data.",
    shortSms: "When relatives ask about the loan, flex our 4-year debt-free date! View tracker: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 19,
    title: '📄 Visualizing The SBI Registry Party',
    body: "Picture this: The day we walk into the SBI branch, collect the original house deed, and tear up the loan passbook in slow motion. ₹2.40L gets us there. Keep pushing!",
    shortSms: "Imagine collecting the original deed from SBI and tearing the loan book in half. ₹2.40L target gets us there: https://vishwascpatil.github.io/sbi-home-loan/",
  },
  {
    id: 20,
    title: '💎 Zero Debt Is The Ultimate Flex',
    body: "New iPhones get outdated in 12 months. Branded shoes wear out in 6 months. A 100% debt-free home with 0 paise owed to SBI? That flex is forever. Drop your share today!",
    shortSms: "A debt-free house with 0 paise owed to SBI is the ultimate family flex. Deposit your monthly share today: https://vishwascpatil.github.io/sbi-home-loan/",
  },
];

let currentIndex = 0;

async function dispatchSingleRound(statementIndex = null, filterPhone = null) {
  const chosenIndex = statementIndex !== null ? statementIndex : (currentIndex % WOW_STATEMENTS.length);
  const statement = WOW_STATEMENTS[chosenIndex];
  currentIndex++;

  const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n======================================================`);
  console.log(`🔔 [${timeStr} IST] WOW NOTIFICATION #${statement.id} of 20`);
  console.log(`Title: ${statement.title}`);
  console.log(`Body:  ${statement.body}`);
  console.log(`======================================================`);

  // 1. Dispatch Web Push to Registered Lock-Screen Devices
  try {
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const subRes = await fetch(`${FIRESTORE_BASE}/loans/${PRIMARY_LOAN_ID}/push_subscriptions`);
    if (subRes.ok) {
      const subData = await subRes.json();
      const docs = subData.documents || [];
      console.log(`📱 Found ${docs.length} active lock-screen push subscription(s)...`);

      const payload = JSON.stringify({
        notification: {
          title: statement.title,
          body: statement.body,
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

        if (filterPhone && phone !== filterPhone) continue;

        if (endpoint && p256dh && auth) {
          try {
            const pushResult = await sendNotification(
              { endpoint, keys: { p256dh, auth } },
              payload
            );
            console.log(`  ✓ Web Push delivered to ${platform} (${phone}): HTTP ${pushResult.statusCode}`);
          } catch (pushErr) {
            console.warn(`  ⚠️ Web Push delivery warning for ${phone}:`, pushErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Web Push lookup error:', err.message);
  }

  // 2. Dispatch Carrier SMS via Fast2SMS
  const recipients = filterPhone
    ? TARGET_FAMILY.filter((m) => m.phone === filterPhone)
    : TARGET_FAMILY;

  if (FAST2SMS_API_KEY && recipients.length > 0) {
    for (const member of recipients) {
      try {
        console.log(`  📲 Sending SMS to ${member.name} (+91${member.phone})...`);
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: `${statement.title}\n\n${statement.body}\n\nLive: https://vishwascpatil.github.io/sbi-home-loan/`,
            flash: 0,
            numbers: member.phone,
          }),
        });

        const smsData = await smsRes.json();
        if (smsData && smsData.return === true) {
          console.log(`  ✓ SMS dispatched to ${member.name}! Req ID: ${smsData.request_id || 'OK'}`);
        } else {
          console.warn(`  ⚠️ Fast2SMS status for ${member.name}:`, smsData.message || JSON.stringify(smsData));
        }
      } catch (err) {
        console.error(`  ❌ Failed sending SMS to ${member.phone}:`, err.message);
      }
    }
  }
}

// ============================================================================
// CLI Argument Parsing & Loop Execution
// ============================================================================
const args = process.argv.slice(2);
const intervalArg = args.find((a) => a.startsWith('--interval='));
const indexArg = args.find((a) => a.startsWith('--index='));
const phoneArg = args.find((a) => a.startsWith('--phone='));
const onceArg = args.includes('--once') || (!intervalArg && !indexArg);

const intervalMinutes = intervalArg ? parseFloat(intervalArg.split('=')[1]) : 5;
const explicitIndex = indexArg ? parseInt(indexArg.split('=')[1], 10) - 1 : null;
const targetPhone = phoneArg ? phoneArg.split('=')[1] : null;

if (onceArg) {
  console.log('🚀 Executing single WOW statement dispatch...');
  await dispatchSingleRound(explicitIndex, targetPhone);
  console.log('✓ Dispatch complete.');
  process.exit(0);
} else {
  console.log(`⏱️ Starting continuous WOW notification loop every ${intervalMinutes} minute(s)...`);
  console.log(`Target Numbers: ${TARGET_FAMILY.map((m) => `${m.name} (${m.phone})`).join(', ')}`);
  console.log('Press Ctrl+C to terminate the loop.\n');

  // Immediate first run
  await dispatchSingleRound(explicitIndex, targetPhone);

  // Periodic interval
  setInterval(async () => {
    try {
      await dispatchSingleRound(null, targetPhone);
    } catch (err) {
      console.error('Error in interval dispatch cycle:', err);
    }
  }, Math.max(10, intervalMinutes * 60) * 1000);
}

