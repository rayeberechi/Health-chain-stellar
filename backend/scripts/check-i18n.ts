import * as fs from 'fs';
import * as path from 'path';

const baseLang = 'en';
const targetLangs = ['fr', 'es', 'ar'];
const i18nPath = path.resolve(__dirname, '../src/i18n');

function getKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((res: string[], el) => {
    if (typeof obj[el] === 'object' && obj[el] !== null && !Array.isArray(obj[el])) {
      return [...res, ...getKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []);
}

try {
  const enPath = path.join(i18nPath, baseLang, 'common.json');
  const baseContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const baseKeys = getKeys(baseContent);
  let hasError = false;

  targetLangs.forEach(lang => {
    const langPath = path.join(i18nPath, lang, 'common.json');
    if (!fs.existsSync(langPath)) {
      console.error(`❌ Missing translation file for ${lang}`);
      hasError = true;
      return;
    }
    const content = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    const keys = getKeys(content);
    const missing = baseKeys.filter(k => !keys.includes(k));
    
    if (missing.length > 0) {
      console.error(`❌ Language ${lang} is missing keys: ${missing.join(', ')}`);
      hasError = true;
    } else {
      console.log(`✅ ${lang} translation coverage is 100%`);
    }
  });

  if (hasError) process.exit(1);
  else console.log('🚀 All translations are in sync!');
} catch (e) {
  console.error('❌ I18n Check Failed:', e.message);
  process.exit(1);
}