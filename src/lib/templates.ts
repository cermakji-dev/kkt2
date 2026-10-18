// Šablony protokolů kontrol. Klíče položek se ukládají do InspectionReport.items,
// proto je neměňte u již používaných šablon (přidávat nové lze kdykoli).

export type TemplateItem = { key: string; label: string; hint?: string };
export type TemplateSection = { key: string; label: string; items: TemplateItem[] };
export type Template = {
  key: string;
  label: string;
  /** Typ záznamu v evidenci kontrol, který vznikne po dokončení. */
  inspectionType: string;
  /** Výchozí interval do další kontroly v měsících. */
  intervalMonths: number;
  sections: TemplateSection[];
};

export const TEMPLATES: Template[] = [
  {
    key: 'rocni',
    label: 'Roční prohlídka objektu',
    inspectionType: 'Roční prohlídka objektu',
    intervalMonths: 12,
    sections: [
      {
        key: 'strecha',
        label: 'Střecha a půda',
        items: [
          { key: 'krytina', label: 'Krytina', hint: 'Prasklé nebo uvolněné prvky, zatékání' },
          { key: 'klempir', label: 'Klempířské prvky', hint: 'Okapy, svody, oplechování atik' },
          { key: 'kominy', label: 'Komíny a ventilace' },
          { key: 'hromosvod', label: 'Hromosvod', hint: 'Svody, svorky, uchycení' },
          { key: 'puda', label: 'Půdní prostory', hint: 'Vlhkost, škůdci, uskladněné věci' },
        ],
      },
      {
        key: 'fasada',
        label: 'Fasáda',
        items: [
          { key: 'plast', label: 'Omítka / zateplení', hint: 'Trhliny, opadávání, graffiti' },
          { key: 'balkony', label: 'Balkony a lodžie', hint: 'Zábradlí, nosné desky, odtok' },
          { key: 'sokl', label: 'Sokl a okapový chodník' },
          { key: 'okna_spol', label: 'Okna společných prostor' },
        ],
      },
      {
        key: 'spolecne',
        label: 'Vstupy a společné prostory',
        items: [
          { key: 'vchod', label: 'Vchodové dveře a zvonky', hint: 'Samozavírač, zámek, el. vrátný' },
          { key: 'schodiste', label: 'Chodby a schodiště', hint: 'Podlahy, zábradlí, malby' },
          { key: 'osvetleni', label: 'Osvětlení společných prostor' },
          { key: 'schranky', label: 'Poštovní schránky a nástěnka' },
          { key: 'sklepy', label: 'Sklepy, kočárkárna, kolárna', hint: 'Vlhkost, pořádek, větrání' },
        ],
      },
      {
        key: 'technika',
        label: 'Technická zařízení',
        items: [
          { key: 'elektro', label: 'Elektrorozvody a rozvaděče', hint: 'Kryty, označení, revizní štítky' },
          { key: 'voda', label: 'Voda a kanalizace', hint: 'Úniky, uzávěry, vodoměry' },
          { key: 'plyn', label: 'Plynovod', hint: 'Uzávěry, označení, zápach' },
          { key: 'kotelna', label: 'Kotelna / výměníková stanice' },
          { key: 'vytah', label: 'Výtah', hint: 'Provoz, kniha výtahu, nouzová komunikace' },
        ],
      },
      {
        key: 'pozar',
        label: 'Požární bezpečnost',
        items: [
          { key: 'php', label: 'Hasicí přístroje', hint: 'Platná kontrola, přístupnost' },
          { key: 'hydranty', label: 'Hydranty' },
          { key: 'unik', label: 'Únikové cesty', hint: 'Volné, bez uskladněných věcí' },
          { key: 'pozdvere', label: 'Požární dveře a uzávěry' },
        ],
      },
      {
        key: 'okoli',
        label: 'Okolí objektu',
        items: [
          { key: 'chodniky', label: 'Chodníky a vjezdy' },
          { key: 'kontejnery', label: 'Kontejnerové stání' },
          { key: 'zelen', label: 'Zeleň a dvůr' },
          { key: 'oploceni', label: 'Oplocení a brány' },
        ],
      },
    ],
  },
  {
    key: 'pozarni',
    label: 'Požární prohlídka',
    inspectionType: 'Kontrola hasicích přístrojů',
    intervalMonths: 12,
    sections: [
      {
        key: 'pozar',
        label: 'Požární zabezpečení',
        items: [
          { key: 'php', label: 'Hasicí přístroje', hint: 'Počet, umístění, platnost kontroly' },
          { key: 'hydranty', label: 'Vnitřní hydranty', hint: 'Hadice, proudnice, tlaková zkouška' },
          { key: 'unik', label: 'Únikové cesty a značení' },
          { key: 'nouzove', label: 'Nouzové osvětlení' },
          { key: 'pozdvere', label: 'Požární dveře a uzávěry' },
          { key: 'eps', label: 'EPS / detektory kouře' },
        ],
      },
      {
        key: 'dokumentace',
        label: 'Dokumentace',
        items: [
          { key: 'pozrad', label: 'Požární řád a poplachové směrnice' },
          { key: 'evakuace', label: 'Evakuační plán' },
          { key: 'kniha', label: 'Požární kniha' },
        ],
      },
    ],
  },
];

export function getTemplate(key: string): Template | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export type ItemState = 'OK' | 'DEFECT' | 'NA';
export type ItemValue = { s?: ItemState; n?: string; task?: boolean };
export type ItemsMap = Record<string, ItemValue>;

/** Klíč položky v rámci šablony: sekce.polozka */
export const itemKey = (section: TemplateSection, item: TemplateItem) => `${section.key}.${item.key}`;

export function reportStats(t: Template, items: ItemsMap) {
  let total = 0;
  let filled = 0;
  let defects = 0;
  for (const s of t.sections)
    for (const i of s.items) {
      total++;
      const v = items[itemKey(s, i)]?.s;
      if (v) filled++;
      if (v === 'DEFECT') defects++;
    }
  return { total, filled, defects };
}
