import type { GoogleFamily } from '@shared/types'

// Short samples for families whose primary script isn't Latin, so their cards show
// real glyphs instead of fallback text. Keyed by ISO 15924 code (Google's primaryScript).
const SAMPLES: Record<string, string> = {
  Arab: 'الخط العربي جميل',
  Armn: 'Հայերեն գրություն',
  Beng: 'বাংলা লিপি সুন্দর',
  Cyrl: 'Съешь же ещё этих мягких булок',
  Deva: 'देवनागरी लिपि सुंदर है',
  Ethi: 'የኢትዮጵያ ፊደል',
  Geor: 'ქართული დამწერლობა',
  Grek: 'Ελληνική γραφή',
  Gujr: 'ગુજરાતી લિપિ',
  Guru: 'ਗੁਰਮੁਖੀ ਲਿਪੀ',
  Hang: '다람쥐 헌 쳇바퀴에 타고파',
  Kore: '다람쥐 헌 쳇바퀴에 타고파',
  Hans: '永和九年岁在癸丑',
  Hant: '永和九年歲在癸丑',
  Hebr: 'כתב עברי יפה',
  Jpan: 'いろはにほへと ちりぬるを',
  Khmr: 'អក្សរខ្មែរ',
  Knda: 'ಕನ್ನಡ ಲಿಪಿ',
  Laoo: 'ອັກສອນລາວ',
  Mlym: 'മലയാളം ലിപി',
  Mymr: 'မြန်မာအက္ခရာ',
  Orya: 'ଓଡ଼ିଆ ଲିପି',
  Sinh: 'සිංහල අකුරු',
  Taml: 'தமிழ் எழுத்து',
  Telu: 'తెలుగు లిపి',
  Thaa: 'ދިވެހި އަކުރު',
  Thai: 'อักษรไทยสวยงาม',
  Tibt: 'བོད་ཡིག',
}

// A few families have no primaryScript, only a subset that says what they're for.
const SUBSET_SAMPLES: Record<string, string> = {
  emoji: '😀 🎨 🦊 🌍 🎉',
  khmer: SAMPLES.Khmr!,
  myanmar: SAMPLES.Mymr!,
  lycian: '𐊁𐊂𐊚𐊑𐊏𐊚 𐊓𐊕𐊑𐊏',
}

// CJK fonts include Latin too, but show their own script.
const CJK = new Set(['Jpan', 'Hans', 'Hant', 'Kore', 'Hang'])

// Non-Latin (and CJK) families get a native sample; Latin fonts that also cover another
// script (e.g. Poppins with Devanagari) keep the user's text.
export function googleSample(family: GoogleFamily, text: string): string {
  if (!family.primaryScript && !family.subsets.includes('latin')) {
    const bySubset = family.subsets.map((s) => SUBSET_SAMPLES[s]).find(Boolean)
    if (bySubset) return bySubset
  }
  const native = SAMPLES[family.primaryScript]
  if (native && (CJK.has(family.primaryScript) || !family.subsets.includes('latin'))) return native
  return text || family.family
}
