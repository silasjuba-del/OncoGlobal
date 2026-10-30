import { consultar, entradaJson } from './integrations/leitura-local.mjs';

const args = process.argv.slice(2);
if (args.length === 0 || args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('OncoGlobal — leitura local\nComandos: acervo buscar | acervo ler | integracoes estado\nEntrada: objeto JSON por stdin. Saída: JSON.\nConfiguração: ONCOGLOBAL_API_URL (loopback), ONCOGLOBAL_API_TOKEN (sessão). Nunca passe credenciais como argumentos.');
} else {
  const nomes = { 'acervo buscar': 'acervo_buscar', 'acervo ler': 'acervo_ler', 'integracoes estado': 'integracoes_estado' };
  try {
    const nome = args.length === 2 ? nomes[args.join(' ')] : undefined;
    if (!nome) throw Error('COMANDO_INVALIDO');
    console.log(JSON.stringify(await consultar(nome, await entradaJson(process.stdin))));
  } catch (e) { console.error(JSON.stringify({ codigo: e instanceof Error ? e.message : 'FALHA_LOCAL' })); process.exitCode = 1; }
}
