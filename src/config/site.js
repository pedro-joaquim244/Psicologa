// Dados demonstrativos. Substitua pelos dados da profissional antes de publicar.
export const site = {
  name: 'Dra. Helena Martins',
  shortName: 'Helena Martins',
  profession: 'Psicóloga Clínica',
  education: 'Psicologia',
  crp: 'CRP 00/000000',
  location: 'Ribeirão Preto — SP',
  whatsappNumber: '5500000000000',
  email: 'contato@example.com',
  instagramUrl: 'https://www.instagram.com/',
};

export function whatsappUrl(message = 'Olá! Gostaria de saber mais sobre o atendimento e agendar uma conversa.') {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

// Fotografias temporárias do Unsplash, salvas localmente para carregamento estável.
// Troque apenas os caminhos abaixo para personalizar todas as imagens da página.
export const images = {
  hero: { src: '/images/consultorio.jpg', alt: 'Sala acolhedora com sofá claro, plantas e luz natural', position: 'center' },
  portrait: { src: '/images/retrato.jpg', alt: 'Retrato feminino ilustrativo da apresentação profissional', position: 'center 38%' },
  detail: { src: '/images/interior.jpg', alt: 'Detalhes de um ambiente tranquilo em tons naturais', position: 'center' },
  nature: { src: '/images/natureza.jpg', alt: 'Luz do sol atravessando as árvores de uma floresta verde', position: 'center' },
};
