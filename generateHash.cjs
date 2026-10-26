const bcrypt = require('bcrypt');

const password = '123456';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) console.error(err);
    console.log(`\n🔑 Contraseña: ${password}`);
    console.log(`🔒 Hash generado: ${hash}`);
    console.log(`\n📋 Ejecuta este SQL en pgAdmin para actualizar tu usuario:\n`);
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@medcore.com';\n`);
});
