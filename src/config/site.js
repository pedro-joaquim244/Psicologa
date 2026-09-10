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

// Fotografias locais dentro de public/images.
// Troque apenas os caminhos abaixo para personalizar as imagens da página.

export const images = {
  hero: {
    src: `${BASE_URL}images/consultorio.jpg`,
    alt: "Sala acolhedora com sofá claro, plantas e luz natural",
    position: "center",
  },

  portrait: {
    src: `${BASE_URL}images/retrato.jpg`,
    alt: "Retrato feminino ilustrativo da apresentação profissional",
    position: "center 38%",
  },

  detail: {
    src: `${BASE_URL}images/interior.jpg`,
    alt: "Detalhes de um ambiente tranquilo em tons naturais",
    position: "center",
  },

  nature: {
    src: `${BASE_URL}images/natureza.jpg`,
    alt: "Luz do sol atravessando as árvores de uma floresta verde",
    position: "center",
  },
};