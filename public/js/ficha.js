// Ficha de detalhes que aparece ao clicar em um avião, terremoto ou satélite.
// Todo texto vindo das APIs entra via textContent, nunca como HTML.

const ficha = document.getElementById('ficha');
const tipo = document.getElementById('ficha-tipo');
const titulo = document.getElementById('ficha-titulo');
const dados = document.getElementById('ficha-dados');
const link = document.getElementById('ficha-link');

function elemento(tag, texto) {
  const el = document.createElement(tag);
  el.textContent = texto;
  return el;
}

export function mostrarFicha(conteudo) {
  ficha.hidden = false;
  tipo.textContent = conteudo.tipo;
  titulo.textContent = conteudo.titulo;
  dados.replaceChildren(
    ...conteudo.linhas.flatMap(([rotulo, valor]) => [
      elemento('dt', rotulo),
      elemento('dd', String(valor)),
    ]),
  );

  const url = conteudo.link?.url;
  if (url && url.startsWith('https://')) {
    link.href = url;
    link.textContent = conteudo.link.texto;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
}

export function esconderFicha() {
  ficha.hidden = true;
}
