import { SEED_DETACHMENTS } from './detachment.model';

const CSV_PATH = 'docs/research/MCL_Department_of_Florida_Detachments.csv';

/** Reads a repo file. Tests run in Node, but the app tsconfig has no Node types, so load fs dynamically. */
async function readRepoFile(path: string): Promise<string> {
  const fsModule = 'node:fs';
  const fs = (await import(/* @vite-ignore */ fsModule)) as { readFileSync(p: string, enc: 'utf8'): string };
  return fs.readFileSync(path, 'utf8');
}

/** R.U.D.Y.'s directory (docs/research/MCL_Department_of_Florida_Detachments.csv): number, name, city. */
async function csvRows(): Promise<{ number: string; name: string; city: string; confidence: string }[]> {
  const text = await readRepoFile(CSV_PATH);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...data] = rows;
  const col = (name: string) => header.indexOf(name);
  return data.map((r) => ({
    number: r[col('Detachment #')].trim(),
    name: r[col('Detachment name')].trim(),
    city: r[col('City/area')].trim(),
    confidence: r[col('Confidence')].trim(),
  }));
}

const byNumber = (n: string) => SEED_DETACHMENTS.find((d) => d.number === n);

describe('SEED_DETACHMENTS (DoF directory seed)', () => {
  it('has the 51 directory detachments plus #1055 (52 rows), all active in the dof department', () => {
    expect(SEED_DETACHMENTS.length).toBe(52);
    expect(SEED_DETACHMENTS.every((d) => d.departmentId === 'dof' && d.active)).toBe(true);
  });

  it('has unique numbers and unique ids, and every id is dof- plus the 3-digit-padded number', () => {
    const ids = SEED_DETACHMENTS.map((d) => d.id);
    const numbers = SEED_DETACHMENTS.map((d) => d.number);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const d of SEED_DETACHMENTS) {
      expect(d.number).toMatch(/^\d+$/);
      expect(d.id).toBe(`dof-${d.number.padStart(3, '0')}`);
      expect(d.displayName).toBe(`Detachment #${d.number} — ${d.name}`);
    }
  });

  it('matches the research CSV row for row (number, name, city)', async () => {
    const rows = await csvRows();
    expect(rows.length).toBe(51);
    for (const r of rows) {
      const d = byNumber(r.number);
      expect(d, `#${r.number} missing`).toBeDefined();
      expect(d!.name).toBe(r.name);
      expect(d!.city).toBe(r.city);
      expect(!!d!.needsVerification, `#${r.number} flag`).toBe(r.confidence !== 'Verified');
    }
    const csvNumbers = new Set(rows.map((r) => r.number));
    expect(SEED_DETACHMENTS.filter((d) => !csvNumbers.has(d.number)).map((d) => d.number)).toEqual(['1055']);
  });

  it('flags exactly #549, #1072, #1476 (single source) and #1055 (OPEN_QUESTIONS #21)', () => {
    const flagged = SEED_DETACHMENTS.filter((d) => d.needsVerification).map((d) => d.number);
    expect(flagged.sort()).toEqual(['1055', '1072', '1476', '549']);
  });

  it('#54 is Morris F. Dixon Jr. (Clearwater), id dof-054, verified', () => {
    const d54 = SEED_DETACHMENTS.filter((d) => d.number === '54');
    expect(d54.length).toBe(1);
    expect(d54[0].id).toBe('dof-054');
    expect(d54[0].name).toContain('Morris F. Dixon Jr');
    expect(d54[0].city).toBe('Clearwater');
    expect(d54[0].needsVerification).toBeFalsy();
  });

  it('applies the Nov 15 corrections (P.A.T. / R.U.D.Y.)', () => {
    expect(byNumber('1267')?.name).toContain('DeLong');
    expect(byNumber('55')).toBeUndefined();
    expect(byNumber('58')?.name).toBe('Indian River');
    expect(byNumber('58')?.city).toBe('Vero Beach');
    expect(byNumber('64')?.name).toContain('Smedley');
    expect(byNumber('567')?.name).toBe('Holiday');
    expect(byNumber('755')?.name).toBe('Tamarac');
    expect(byNumber('990')?.name).toBe('Gator');
  });

  it('Archambault is #819 (Crystal River), verified, and the old number-less row is gone', () => {
    const a = SEED_DETACHMENTS.filter((d) => d.name.includes('Archambault'));
    expect(a.length).toBe(1);
    expect(a[0].number).toBe('819');
    expect(a[0].id).toBe('dof-819');
    expect(a[0].city).toBe('Crystal River');
    expect(a[0].needsVerification).toBeFalsy();
    expect(SEED_DETACHMENTS.some((d) => d.id === 'dof-archambault-unverified')).toBe(false);
  });
});
