const db = require('./db');
const bcrypt = require('bcrypt');

(async () => {
  try {
    const hash = await bcrypt.hash('StrongPass123!', 10);
    db.run(
      "INSERT INTO users (name, email, password, state, role) VALUES (?, ?, ?, ?, ?)",
      ['Alice Admin', 'alice@admin.test', hash, 'Lagos', 'admin'],
      function(err) {
        if (err) {
          console.error('insert error', err.message);
        } else {
          console.log('Inserted admin id', this.lastID);
        }
        process.exit(0);
      }
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
