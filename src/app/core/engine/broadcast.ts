import { LedgerState, Member, Transaction, getTransactionAmount, getTransactionMode } from './models';
import { divideHalfUp, formatPaise, Paise, paise, toRupees } from './money';
import { monthlySummary, memberStatistics, outstandingAt } from './ledger';

export interface BroadcastMessage {
  title: string;
  body: string;
  whatsappUrl: string;
}

/**
 * Computes daily reducing balance interest using integer paise with BigInt precision.
 */
export function computeDailyInterest(principal: Paise, rateBps: number, basisDays = 365): Paise {
  if (principal <= 0 || rateBps <= 0) return paise(0);
  const numerator = BigInt(principal) * BigInt(rateBps) * 1_000_000n;
  const denominator = BigInt(basisDays) * 10_000n;
  const scaled = numerator / denominator;
  return paise(Number(divideHalfUp(scaled, 1_000_000n)));
}

/**
 * Builds the daily 9:00 AM notification informing members of today's interest
 * and the updated loan outstanding amount.
 */
export function buildDailyInterestBroadcast(
  state: LedgerState,
  targetPhone?: string,
  dateIso: string = new Date().toISOString().slice(0, 10)
): BroadcastMessage {
  const principal = outstandingAt(dateIso, state);
  const basisDays = state.loan.bankRules?.dayCountBasis === '360' ? 360 : 365;
  const dailyInt = computeDailyInterest(principal, state.loan.currentRateBps, basisDays);
  const newBalance = paise(principal + dailyInt);

  const dateObj = new Date(dateIso);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const body = [
    `🏦 *SBI Home Loan Daily Update* (${formattedDate})`,
    ``,
    `• Today's Interest Added: *+${formatPaise(dailyInt)}*`,
    `• Current Loan Outstanding: *${formatPaise(newBalance)}*`,
    `• Interest Rate: *${(state.loan.currentRateBps / 100).toFixed(2)}% p.a.*`,
    `• A/C Number: *${state.loan.accountNumber}*`,
    ``,
    `View Live Tracker:`,
    `https://vishwascpatil.github.io/sbi-home-loan/`,
  ].join('\n');

  const cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
  const phoneParam = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : '';
  const whatsappUrl = phoneParam
    ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(body)}`
    : `https://wa.me/?text=${encodeURIComponent(body)}`;

  return {
    title: `Daily Interest Update: +${formatPaise(dailyInt)}`,
    body,
    whatsappUrl,
  };
}

/**
 * Builds the 1st of the month payment due reminder for a specific member.
 * Kept short and crisp for mobile notification.
 */
export function buildMonthlyDueReminder(
  member: Member,
  state: LedgerState,
  forMonth: string = new Date().toISOString().slice(0, 7)
): BroadcastMessage {
  const stats = memberStatistics(member.id, state, forMonth);
  const target = member.target || paise(0);
  const paidThisMonth = stats.thisMonthContribution;
  const remainingDue = paise(Math.max(0, target - paidThisMonth));

  const monthName = new Date(`${forMonth}-01`).toLocaleDateString('en-IN', {
    month: 'long',
  });

  let messageText = '';
  if (remainingDue <= 0) {
    messageText = [
      `✅ *Home Loan EMI Confirmed*`,
      `Hi ${member.name}, your ${monthName} share of ${formatPaise(target)} has been received.`,
      `Outstanding loan balance is actively reducing. Thank you!`,
      ``,
      `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`,
    ].join('\n');
  } else {
    messageText = [
      `🔔 *Home Loan EMI Due Reminder*`,
      `Hi ${member.name}, your ${monthName} contribution of *${formatPaise(remainingDue)}* is due by the 5th.`,
      `Please deposit to SBI OD A/C *${state.loan.accountNumber}*.`,
      ``,
      `Tracker: https://vishwascpatil.github.io/sbi-home-loan/`,
    ].join('\n');
  }

  const cleanPhone = member.phone ? member.phone.replace(/\D/g, '') : '';
  const phoneParam = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : '';
  const whatsappUrl = phoneParam
    ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  return {
    title: `EMI Due Reminder for ${member.name}`,
    body: messageText,
    whatsappUrl,
  };
}

/**
 * Generates an Excel Spreadsheet (.xls XML format) containing:
 * 1. Member-wise Annual Contribution Summary
 * 2. Detailed Ledger Transactions
 * 3. Loan Overview & Interest Summary
 */
export function generateAnnualExcelSpreadsheet(state: LedgerState): Blob {
  const curMonth = new Date().toISOString().slice(0, 7);
  const activeMembers = state.members.filter((m) => !m.deletedAt);
  const activeTx = state.transactions
    .filter((tx) => !tx.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));

  const memberSummaryRows = activeMembers.map((m) => {
    const stats = memberStatistics(m.id, state, curMonth);
    const target = m.target ? toRupees(m.target) : 0;
    const paid = toRupees(stats.lifetimeContribution);
    const thisMonthPaid = toRupees(stats.thisMonthContribution);
    return `
      <Row>
        <Cell><Data ss:Type="String">${m.name}</Data></Cell>
        <Cell><Data ss:Type="String">${m.phone || 'N/A'}</Data></Cell>
        <Cell><Data ss:Type="String">${m.email || 'N/A'}</Data></Cell>
        <Cell><Data ss:Type="Number">${target}</Data></Cell>
        <Cell><Data ss:Type="Number">${thisMonthPaid}</Data></Cell>
        <Cell><Data ss:Type="Number">${paid}</Data></Cell>
        <Cell><Data ss:Type="Number">${stats.contributionCount}</Data></Cell>
        <Cell><Data ss:Type="String">${stats.lastContributionDate || 'None'}</Data></Cell>
      </Row>`;
  }).join('');

  const txRows = activeTx.map((tx: Transaction) => {
    const memberName = 'memberId' in tx ? state.members.find((m) => m.id === tx.memberId)?.name || 'Unknown' : 'Bank Payment';
    const amount = toRupees(getTransactionAmount(tx));
    const mode = getTransactionMode(tx);
    const forMonth = tx.forMonth || tx.date.slice(0, 7);
    const ref = ('reference' in tx ? tx.reference : '') || '-';
    const notes = tx.notes || '-';
    return `
      <Row>
        <Cell><Data ss:Type="String">${tx.date}</Data></Cell>
        <Cell><Data ss:Type="String">${forMonth}</Data></Cell>
        <Cell><Data ss:Type="String">${tx.type}</Data></Cell>
        <Cell><Data ss:Type="String">${memberName}</Data></Cell>
        <Cell><Data ss:Type="Number">${amount}</Data></Cell>
        <Cell><Data ss:Type="String">${mode}</Data></Cell>
        <Cell><Data ss:Type="String">${ref}</Data></Cell>
        <Cell><Data ss:Type="String">${notes}</Data></Cell>
      </Row>`;
  }).join('');

  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#15172B" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#15172B"/>
    </Style>
  </Styles>
  
  <Worksheet ss:Name="Member Contributions">
    <Table>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="180"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Column ss:Width="110"/>
      <Column ss:Width="80"/>
      <Column ss:Width="100"/>
      <Row>
        <Cell ss:StyleID="Title"><Data ss:Type="String">SBI Home Loan - Member Annual Contribution Summary</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Member Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Phone Number</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Email</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Monthly Target (₹)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">This Month Paid (₹)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Paid (₹)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Payments</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Last Payment Date</Data></Cell>
      </Row>
      ${memberSummaryRows}
    </Table>
  </Worksheet>

  <Worksheet ss:Name="Transaction History">
    <Table>
      <Column ss:Width="90"/>
      <Column ss:Width="80"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="90"/>
      <Column ss:Width="120"/>
      <Column ss:Width="150"/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">For Month</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Member</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Amount (₹)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Mode</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Reference</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Notes</Data></Cell>
      </Row>
      ${txRows}
    </Table>
  </Worksheet>
</Workbook>`;

  return new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
}

/**
 * Builds the mailto URL for November 1st annual reporting with summary breakdown.
 */
export function buildAnnualReportMailtoUrl(state: LedgerState): string {
  const curMonth = new Date().toISOString().slice(0, 7);
  const activeMembers = state.members.filter((m) => !m.deletedAt);
  const emails = activeMembers.map((m) => m.email).filter(Boolean).join(',');

  const subject = `SBI Home Loan - Annual Payment & Excel Report (${new Date().getFullYear()})`;

  const memberBreakdown = activeMembers.map((m) => {
    const stats = memberStatistics(m.id, state, curMonth);
    return `• ${m.name}: Total Paid ₹${toRupees(stats.lifetimeContribution).toLocaleString('en-IN')} (Target: ₹${toRupees(m.target || paise(0)).toLocaleString('en-IN')}/mo)`;
  }).join('\n');

  const monthSum = monthlySummary(curMonth, state);

  const body = [
    `Dear Family Members,`,
    ``,
    `Here is the Annual SBI Home Loan Overdraft contribution status and numbers summary as of November 1st:`,
    ``,
    `Account Number: ${state.loan.accountNumber}`,
    `Approved Limit: ${formatPaise(state.loan.sanctionedLimit)}`,
    `Current Loan Outstanding: ${formatPaise(monthSum.openingOutstanding)}`,
    `Current Interest Rate: ${(state.loan.currentRateBps / 100).toFixed(2)}% p.a.`,
    ``,
    `--- MEMBER CONTRIBUTION SUMMARY ---`,
    memberBreakdown,
    ``,
    `A detailed Excel ledger spreadsheet is exportable directly from the tracker:`,
    `https://vishwascpatil.github.io/sbi-home-loan/`,
    ``,
    `Regards,`,
    `SBI Home Loan EMI Tracker`,
  ].join('\n');

  return `mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
