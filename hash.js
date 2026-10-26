import bcrypt from 'bcrypt';

const password = '123456'; // La contraseña que quieres usar
const saltRounds = 10;

const hashPassword = async () => {
  const hash = await bcrypt.hash(password, saltRounds);
  console.log(hash);
};

hashPassword();
