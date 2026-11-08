import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';

async function extract() {
  const doc = await pdfjs.getDocument('C:/Users/vishw/.gemini/antigravity/brain/b6d4fcb2-0808-4514-9a95-e4ea539695cb/.user_uploaded/media_1794124595759_ff1f5b5f.pdf').promise;

  let allItems = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const pageItems = tc.items.map(i => i.str.trim()).filter(Boolean);
    allItems = allItems.concat(pageItems);
  }

  const txs = [];
  for (let i = 0; i < allItems.length; i++) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(allItems[i]) && i + 1 < allItems.length && /^\d{2}\/\d{2}\/\d{4}$/.test(allItems[i+1])) {
      const postDate = allItems[i];
      const valueDate = allItems[i+1];
      let j = i + 2;
      let desc = '';
      while (j < allItems.length && !/^(\d{2}\/\d{2}\/\d{4}|Page no)/.test(allItems[j]) && allItems[j] !== '-' && !/^\d{1,3}(,\d{2,3})*(\.\d{2})?$/.test(allItems[j])) {
        desc += (desc ? ' ' : '') + allItems[j];
        j++;
      }

      const tokens = [];
      while (j < allItems.length && !/^(\d{2}\/\d{2}\/\d{4}|Page no)/.test(allItems[j])) {
        tokens.push(allItems[j]);
        j++;
      }

      const refNo = tokens[0] === '-' ? '' : tokens[0];
      const debitStr = tokens[1] === '-' ? '' : tokens[1];
      const creditStr = tokens[2] === '-' ? '' : tokens[2];
      const balanceStr = tokens[3] || '';

      let category = 'other';
      let type = 'debit';
      if (creditStr) {
        type = 'credit';
        if (desc.includes('SI 54897 RACPC')) category = 'emi_credit';
        else category = 'prepayment';
      } else {
        if (desc.includes('TO INTEREST')) category = 'interest_debit';
        else if (desc.includes('RLMS')) category = 'disbursement';
        else category = 'withdrawal';
      }

      const parts = postDate.split('/');
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

      const toPaiseNum = (s) => s ? Math.round(parseFloat(s.replace(/,/g, '')) * 100) : 0;

      txs.push({
        id: `tx-sbi-${(txs.length + 1).toString().padStart(3, '0')}`,
        postDate,
        valueDate,
        isoDate,
        desc,
        refNo,
        type,
        category,
        debitPaise: toPaiseNum(debitStr),
        creditPaise: toPaiseNum(creditStr),
        balancePaise: toPaiseNum(balanceStr),
        rawDebit: debitStr,
        rawCredit: creditStr,
        rawBalance: balanceStr
      });
      i = j - 1;
    }
  }

  const fileContent = `import { Paise } from '../engine';

export interface SbiPassbookRow {
  id: string;
  postDate: string;
  valueDate: string;
  isoDate: string;
  desc: string;
  refNo: string;
  type: 'credit' | 'debit';
  category: 'emi_credit' | 'prepayment' | 'interest_debit' | 'withdrawal' | 'disbursement' | 'other';
  debitPaise: Paise;
  creditPaise: Paise;
  balancePaise: Paise;
  rawDebit: string;
  rawCredit: string;
  rawBalance: string;
}

export const SBI_AUTHENTIC_STATEMENT_ROWS: SbiPassbookRow[] = ${JSON.stringify(txs, null, 2)} as unknown as SbiPassbookRow[];
`;

  fs.writeFileSync('src/app/core/data/sbi-statement-records.ts', fileContent, 'utf-8');
  console.log('SUCCESS: Written', txs.length, 'records to src/app/core/data/sbi-statement-records.ts');
}

extract().catch(console.error);
