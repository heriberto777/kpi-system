import { AuthService } from '../services/auth.service';

const password = process.argv[2];

if (!password) {
  // eslint-disable-next-line no-console
  console.error('Uso: npm run hash-password -- <contraseña>');
  process.exit(1);
}

AuthService.generarHash(password).then((hash) => {
  // eslint-disable-next-line no-console
  console.log(hash);
});
