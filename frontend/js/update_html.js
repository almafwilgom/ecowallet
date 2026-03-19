/* eslint-env node */
/* global require, __dirname */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

console.log('Scanning HTML files for update...');

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Replace standard script tag with module type
    if (content.includes('src="js/api.js"') && !content.includes('type="module" src="js/api.js"')) {
        content = content.replace('src="js/api.js"', 'type="module" src="js/api.js"');
        updated = true;
    }
    
    if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated ${file}`);
    } else {
        console.log(`- Skipped ${file} (already updated or script not found)`);
    }
});

console.log('Done.');