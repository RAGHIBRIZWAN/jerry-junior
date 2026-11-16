// Reads product name, price, sizes and category out of a Facebook post caption.
// Captions are free text, so this is best-effort; check imported products in the admin panel.

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Facebook exports store UTF-8 text as latin1 escapes ("Ã°Å¸â€â€¢"). Fix that. */
export function fixFacebookText(s) {
  if (typeof s !== 'string' || !s) return '';
  if (![...s].every((ch) => ch.charCodeAt(0) < 256)) return s;
  if (!/[Â-ô][\u0080-¿]/.test(s)) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  return fixed.includes('�') ? s : fixed;
}

const num = (s) => Number(String(s).replace(/,/g, ''));
const plausible = (n) => Number.isFinite(n) && n >= 100 && n <= 200000;

export function parsePrice(text) {
  const lines = text.split(/\n/);
  const patterns = [
    // "Price: Rs 1,450/-", "Rate 1200", "Rs. 999", "PKR 2,000", "₨1500"
    /(?:price|rate|rs\.?|pkr|₨)\s*[:=\-–]?\s*(?:rs\.?|pkr|₨)?\s*(\d[\d,]*)/i,
    // "1450/-", "1450 Rs", "1450 PKR", "1450 only"
    /(\d[\d,]*)\s*(?:\/-|rs\b\.?|pkr\b|₨|only\b)/i,
  ];
  // "sale now 2500" / "discount price 1800" wins over the normal price.
  for (const line of lines) {
    const m = line.match(/\b(?:sale|now|discount(?:ed)?|offer)\b[^\d\n]{0,20}(\d[\d,]*)/i);
    if (m && plausible(num(m[1]))) return num(m[1]);
  }
  const ordered = [...lines.filter((l) => /\b(sale|now|discount|offer)\b/i.test(l)), ...lines];
  for (const re of patterns) {
    for (const line of ordered) {
      const m = line.match(re);
      if (m && plausible(num(m[1]))) return num(m[1]);
    }
  }
  return null;
}

const SIZE_TOKEN =
  /^(?:\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:y|yr|yrs|year|years|m|mon|months)?|\d{1,2}\s*(?:y|yr|yrs|year|years|m|mon|months)|x{0,3}s|x{0,3}l|m|xxl|xxxl|\d{1,2}|free\s*size|one\s*size)$/i;

function normaliseSize(t) {
  let s = t.trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*(?:–|to)\s*/i, '-').replace(/\s*-\s*/, '-');
  s = s.replace(/\s*(?:y|yr|yrs|year|years)$/i, 'Y').replace(/\s*(?:m|mon|months)$/i, (x) => (/^\d/.test(s) ? 'M' : x));
  if (/^(x{0,3}s|x{0,3}l|m|xxl|xxxl)$/i.test(s)) s = s.toUpperCase();
  if (/^(free|one)\s*size$/i.test(s)) s = 'Free Size';
  return s;
}

export function parseSizes(text) {
  const found = [];
  const add = (s) => {
    const n = normaliseSize(s);
    if (n && !found.includes(n)) found.push(n);
  };

  // 1) A line that starts with "Size(s)" / "Age(s)"
  for (const line of text.split(/\n/)) {
    const m = line.match(/\b(?:sizes?|ages?|size\s*range)\b\s*(?:available)?\s*[:=\-–]?\s*(.+)$/i);
    if (!m) continue;
    // e.g. "2-3, 4-5 & 6-7 years" -> years applies to all
    const rest = m[1].replace(EMOJI, ' ');
    const unit = /\b(y|yrs?|years?)\b/i.test(rest) ? 'Y' : /\bmonths?\b/i.test(rest) ? 'M' : '';
    const cleaned = rest.replace(/\b(available|only|in|all|stock)\b/gi, ' ');
    const tokens = cleaned
      .split(/[,|•·;\/]+|\s+&\s+|\s+and\s+|\s{2,}|\s+(?=\d{1,2}\s*(?:-|–|to)\s*\d)|\s+(?=x{0,3}[sml]\b)/i)
      .map((t) => t.replace(/[()]/g, '').trim())
      .filter(Boolean);
    for (const tok of tokens) {
      if (!SIZE_TOKEN.test(tok)) continue;
      // bare age range like "2-3" when the line says "years"
      add(unit && /^\d{1,2}\s*(?:-|–|to)\s*\d{1,2}$/i.test(tok) ? `${tok}${unit === 'Y' ? ' years' : ' months'}` : tok);
    }
    if (found.length) return found;
  }

  if (/\b(free|one)\s*size\b/i.test(text)) return ['Free Size'];

  // 2) Age ranges anywhere: "for 2-3 years", "6 - 12 months"
  const re = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(y|yrs?|years?|months?)\b/gi;
  let m;
  while ((m = re.exec(text))) add(`${m[1]}-${m[2]} ${m[3]}`);
  return found;
}

const NOISE_LINE =
  /(price|rate|rs\.?\s*\d|pkr|₨|\d\s*\/-|sizes?\b|ages?\b|whats\s*app|inbox|dm\b|call|contact|order now|delivery|cod\b|cash on|\+?92\s*\d|03\d{2}|https?:\/\/|www\.)/i;

const NOISE_START =
  /(price|rate\b|rs\.?\s*\d|pkr|₨|\d[\d,]*\s*\/-|sizes?\b|ages?\b|\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:y|m)|\d{1,2}\s*(?:years?|yrs?|months?)\b|free\s*size|whats\s*app|inbox|\bdm\b|call\b|contact)/i;

function cleanLine(line) {
  return line
    .replace(EMOJI, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/^[\s\-–•*~_:|.!]+|[\s\-–•*~_:|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseTitle(text) {
  const lines = text.split(/\n/).map(cleanLine).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(?:name|title|article|product|item|design)\s*(?:name|no\.?|#)?\s*[:=\-–]\s*(.+)$/i);
    if (m && /\p{L}/u.test(m[1])) return shorten(m[1]);
  }
  for (const line of lines) {
    if (!/\p{L}{2,}/u.test(line)) continue;
    if (!NOISE_LINE.test(line)) return shorten(line);
    // "Baby romper 0-3 months Rs 1800" -> "Baby romper"
    const cut = line.search(NOISE_START);
    const prefix = cut > 0 ? cleanLine(line.slice(0, cut)) : '';
    if (/\p{L}{3,}/u.test(prefix)) return shorten(prefix);
  }
  return '';
}

function shorten(s) {
  s = s.replace(/[.!]+$/, '').trim();
  if (s.length > 70) s = `${s.slice(0, 67).replace(/\s+\S*$/, '')}…`;
  // "BOYS SUMMER SHIRT" -> "Boys Summer Shirt"
  if (s === s.toUpperCase() && /[A-Z]{3}/.test(s)) s = s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return s;
}

export function parseCategory(text) {
  const t = text.toLowerCase();
  if (/\b(new\s*born|newborn|infant|baby|babies)\b/.test(t)) return 'Baby';
  const girl = /\b(girls?|frock|frocks|dress|dresses|skirt)\b/.test(t);
  const boy = /\b(boys?)\b/.test(t);
  if (girl && !boy) return 'Girls';
  if (boy && !girl) return 'Boys';
  if (/\bunisex\b/.test(t) || (boy && girl)) return 'Unisex';
  return '';
}

/** Description shown on the website: the caption without hashtags, phone numbers and contact lines. */
export function cleanCaption(text) {
  return text
    .split(/\n/)
    .filter((l) => !/(whats\s*app|inbox|\bdm\b|call\s*(us|now)|\+?92\s*\d{3}|03\d{2}\s*-?\s*\d{7})/i.test(l))
    .map((l) => l.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);
}

export function parseCaption(raw) {
  const text = fixFacebookText(raw || '');
  return {
    title: parseTitle(text),
    price: parsePrice(text),
    sizes: parseSizes(text),
    category: parseCategory(text),
    caption: cleanCaption(text),
  };
}
