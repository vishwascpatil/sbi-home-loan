/**
 * SBI Maxgain Home Loan PDF Statement Parser
 *
 * Extracts text items from SBI Account Statement PDFs using pdfjs-dist
 * and converts them into normalized statement records for ledger matching.
 */

export interface ParsedPdfRow {
  date: string;
  description: string;
  refNo?: string;
  debit: string;
  credit: string;
  balance: string;
}

export async function parseSbiPdfStatement(dataBuffer: ArrayBuffer): Promise<Record<string, string>[]> {
  try {
    // Dynamic import of pdfjs-dist so it only loads when a PDF is dropped
    const pdfjs = await import('pdfjs-dist');
    
    // In browser context without worker configured, use inline worker fallback if available
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });

    const doc = await loadingTask.promise;
    const records: Record<string, string>[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = (textContent.items as { str: string }[])
        .map((i) => i.str.trim())
        .filter(Boolean);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // SBI statements list: Post Date (DD/MM/YYYY), Value Date (DD/MM/YYYY)
        if (
          /^\d{2}\/\d{2}\/\d{4}$/.test(item) &&
          i + 1 < items.length &&
          /^\d{2}\/\d{2}\/\d{4}$/.test(items[i + 1])
        ) {
          const postDate = items[i];
          let j = i + 2;
          let desc = '';

          // Accumulate description tokens until dash or currency amount
          while (
            j < items.length &&
            items[j] !== '-' &&
            !/^\d{1,3}(,\d{2,3})*(\.\d{2})?$/.test(items[j])
          ) {
            desc += (desc ? ' ' : '') + items[j];
            j++;
          }

          let debit = '';
          let credit = '';
          let balance = '';

          if (j < items.length) {
            if (items[j] === '-') {
              // Debit is dash (-) -> Credit transaction
              j++;
              if (j < items.length && items[j] === '-') {
                j++; // Skip ref no dash if present
              }
              credit = items[j++] || '';
              balance = items[j++] || '';
            } else {
              // Debit transaction
              debit = items[j++] || '';
              if (j < items.length && items[j] === '-') {
                j++; // Skip credit dash
              }
              balance = items[j++] || '';
            }
          }

          records.push({
            'Txn Date': postDate,
            'Description': desc,
            'Ref No./Cheque No.': '',
            'Debit': debit === '-' ? '' : debit,
            'Credit': credit === '-' ? '' : credit,
            'Balance': balance,
          });
        }
      }
    }

    return records;
  } catch (error) {
    console.error('Failed to parse SBI PDF Statement:', error);
    return [];
  }
}
