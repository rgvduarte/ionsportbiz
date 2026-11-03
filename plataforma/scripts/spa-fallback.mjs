// Alojamentos estáticos sem reescrita de rotas (ex.: GitHub Pages) servem 404.html para links
// como /c/<token>. Uma cópia do index.html faz a app abrir na rota certa.
import { copyFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/404.html');
