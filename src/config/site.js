import imageManifest from './image-manifest.json';

// Dados demonstrativos.
// Substitua pelos dados da profissional antes de publicar.

export const site = {
  name: "Dra. Helena Martins",
  shortName: "Helena Martins",
  profession: "Psicóloga Clínica",
  education: "Psicologia",
  crp: "CRP 00/000000",
  location: "Ribeirão Preto — SP",
  whatsappNumber: "5500000000000",
  email: "contato@example.com",
  instagramUrl: "https://www.instagram.com/",
};

export function whatsappUrl(
  message = "Olá! Gostaria de saber mais sobre o atendimento e agendar uma conversa."
) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(
    message
  )}`;
}

// Base correta para funcionar tanto localmente quanto no GitHub Pages.
const BASE_URL = import.meta.env.BASE_URL;

// Fontes preservadas em public/images; variantes geradas por npm run images:prepare.
function photo(name, alt, position = 'center') {
  const asset = imageManifest[name];
  return {
    src: `${BASE_URL}${asset.src}`,
    srcSet: asset.variants.map(variant => `${BASE_URL}${variant.src} ${variant.width}w`).join(', '),
    width: asset.width, height: asset.height, alt, position,
  };
}

export const images = {
  hero: photo('sala', 'Sala acolhedora com sofá de linho, plantas e luz natural', '48% 55%'),
  portrait: photo('retrato', 'Retrato ilustrativo de uma psicóloga sentada em uma poltrona, com um caderno', '50% 38%'),
  detail: photo('botanica', 'Ramos verdes em um vaso de cerâmica iluminado pelo sol'),
  listening: photo('escuta', 'Poltrona clara com manta e uma mesa lateral junto à janela', '60% 55%'),
  understanding: photo('escrita', 'Caderno aberto e uma xícara sobre uma mesa de madeira', '50% 60%'),
  growth: photo('caminho', 'Caminho entre árvores e vegetação iluminado pela luz da manhã'),
  inPerson: photo('presencial', 'Ambiente de atendimento com poltronas, sofá e plantas'),
  online: photo('online', 'Notebook em uma mesa junto à janela, preparado para uma conversa online'),
  nature: photo('natureza', 'Luz do sol atravessando as árvores de uma floresta verde'),
  closing: photo('recomeco', 'Porta aberta para um jardim tranquilo iluminado pelo sol'),
};
