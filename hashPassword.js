// H:\jj-canteen-backend\hashPassword.js
const bcrypt = require('bcryptjs');

// --- SET YOUR DESIRED PASSWORD HERE ---
const plainPassword = 'chef123';
// ------------------------------------

const saltRounds = 10;

console.log(`Hashing password: ${plainPassword}`);
console.log("Please wait...");

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error("Error hashing password:", err);
        return;
    }
    console.log("\n--- COPY YOUR HASHED PASSWORD BELOW ---");
    console.log(hash);
    console.log("----------------------------------------\n");
});