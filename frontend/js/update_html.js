/* eslint-env node */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix: Scan the parent directory (frontend/) where HTML files are located
const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

console.log('Scanning HTML files for update...');

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Ensure a root <base> tag exists so asset paths resolve on Cloudflare/clean URLs
    const baseRegex = /<base\s+href=["']\/["'][^>]*>/i;
    if (!baseRegex.test(content)) {
        content = content.replace(/<head([^>]*)>/i, `<head$1>\n    <base href="/">`);
        updated = true;
    }
    
    // Regex to match script src="js/api.js" without type="module"
    const apiRegex = /<script\s+(?:[^>]*?\s+)?src=["']\/?js\/api\.js["'][^>]*><\/script>/gi;
    
    content = content.replace(apiRegex, (match) => {
        if (match.includes('type="module"')) return match;
        updated = true;
        return '<script type="module" src="js/api.js"></script>';
    });

    // Regex to match script src="js/auth.js" without type="module" (Ensure correct order/loading)
    const authRegex = /<script\s+(?:[^>]*?\s+)?src=["']\/?js\/auth\.js["'][^>]*><\/script>/gi;
    content = content.replace(authRegex, (match) => {
        if (match.includes('type="module"')) return match;
        updated = true;
        return '<script type="module" src="js/auth.js"></script>';
    });

    // Remove conflicting Supabase CDN script (The Root Cause of "Redeclaration" errors)
    const cdnRegex = /<script\s+[^>]*src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js["'][^>]*><\/script>/gi;
    if (cdnRegex.test(content)) {
        content = content.replace(cdnRegex, '');
        updated = true;
        console.log(`- Removed conflicting Supabase CDN script from ${file}`);
    }
    
    if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated ${file}`);
    } else {
        console.log(`- Skipped ${file} (already updated or script not found)`);
    }
});

console.log('Done.');
