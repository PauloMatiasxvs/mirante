# Mirante

**O planeta ao vivo, só com dados abertos.** Um globo 3D no navegador que mostra,
em tempo real, os aviões voando sobre o Brasil, os terremotos das últimas 24 horas
e os satélites e estações espaciais em órbita.

![Voos ao vivo sobre São Paulo](docs/voos-sao-paulo.png)

## O que dá para fazer

- ✈️ **Voos ao vivo no Brasil**: posição, altitude, velocidade, modelo e matrícula de
  cada avião. Entre uma atualização e outra o avião continua andando no mapa,
  calculado a partir da velocidade e do rumo.
- 🌋 **Terremotos das últimas 24 h** no mundo todo, com tamanho e cor pela magnitude
  e uma onda animada nos mais fortes.
- 🛰️ **Satélites e estações espaciais**: as órbitas são calculadas no próprio navegador
  (modelo SGP4). Dá para seguir a ISS e ver a próxima volta dela ao redor da Terra.
- 🎥 **Modos de visão** feitos com shaders: visão noturna e câmera térmica.
- 🖱️ Clique em qualquer ponto para abrir uma ficha com os detalhes.

| Visão noturna | Térmica | Planeta |
| --- | --- | --- |
| ![Visão noturna](docs/visao-noturna.png) | ![Térmica](docs/termica.png) | ![Planeta](docs/planeta.png) |

## Como rodar

Precisa só do [Node.js](https://nodejs.org) 20 ou mais novo. Não há dependências
para instalar e nenhuma chave de API.

```bash
git clone https://github.com/PauloMatiasxvs/mirante.git
cd mirante
npm start
```

Depois abra <http://localhost:5180>.

## Como funciona

```
public/                 site estático (HTML, CSS e JavaScript puro)
  js/main.js            monta o globo e liga os controles
  js/camadas/           uma camada por fonte de dados
  js/modos.js           shaders de visão noturna e térmica
api/flights.js          rota que busca os voos (o adsb.lol não libera CORS)
server.mjs              servidor local sem dependências
```

O globo usa o [CesiumJS](https://cesium.com/platform/cesiumjs/) e as órbitas usam o
[satellite.js](https://github.com/shashwatak/satellite-js), ambos carregados por CDN.

### Publicar na Vercel

O projeto já está pronto para a [Vercel](https://vercel.com): a pasta `public/` vira o
site e `api/flights.js` vira uma função serverless. Basta importar o repositório.

## Fontes de dados

| Dado | Fonte | Observação |
| --- | --- | --- |
| Voos | [adsb.lol](https://adsb.lol) | Rede comunitária de receptores ADS-B, dados sob ODbL |
| Terremotos | [USGS](https://earthquake.usgs.gov/earthquakes/feed/) | Feed público do Serviço Geológico dos EUA |
| Órbitas | [CelesTrak](https://celestrak.org) | Elementos orbitais (TLE), guardados em cache por 2 h |
| Imagens | [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) | Imagens de satélite com atribuição |

A cobertura de voos depende dos receptores voluntários de cada região: é maior no
Sudeste e nas capitais.

## Licença

[MIT](LICENSE) © 2026 PauloMatiasxvs
