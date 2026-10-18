export const CONTACT_ROLE: Record<string, string> = {
  PREDSEDA: 'Předseda výboru',
  MISTOPREDSEDA: 'Místopředseda',
  CLEN_VYBORU: 'Člen výboru',
  DOMOVNIK: 'Domovník',
  SPRAVCE: 'Správce / kontaktní osoba SBD',
  KONTAKT: 'Kontakt',
};

export const UNIT_TYPE: Record<string, string> = { BYT: 'Byt', NEBYT: 'Nebytový prostor', GARAZ: 'Garáž / stání', SKLEP: 'Sklep' };

export const METER_KIND: Record<string, { label: string; unit: string; verifyYears: number | null }> = {
  SV: { label: 'Studená voda', unit: 'm³', verifyYears: 6 },
  TUV: { label: 'Teplá voda', unit: 'm³', verifyYears: 5 },
  TEPLO: { label: 'Kalorimetr', unit: 'GJ', verifyYears: 5 },
  ELEKTRO: { label: 'Elektroměr', unit: 'kWh', verifyYears: null },
  PLYN: { label: 'Plynoměr', unit: 'm³', verifyYears: null },
  RTN: { label: 'Indikátor topných nákladů', unit: 'dílků', verifyYears: null },
};

export const DOC_CATEGORY: Record<string, string> = {
  SMLOUVA: 'Smlouva',
  REVIZNI_ZPRAVA: 'Revizní zpráva',
  PROJEKT: 'Projektová dokumentace',
  ZAPIS: 'Zápis ze schůze',
  PASPORT: 'Pasport domu',
  FOTO: 'Fotografie',
  JINE: 'Jiné',
};

export function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} kB`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
