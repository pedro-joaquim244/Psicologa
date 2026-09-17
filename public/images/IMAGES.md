# Fotografias do site

As imagens `sala.png`, `Poltrona.png`, `LivroAberto.png` e `Psicologa32.png` foram fornecidas na pasta do projeto. O retrato continua sendo tratado como ilustrativo. `consultorio.jpg` e `natureza.jpg` são arquivos preexistentes.

As quatro imagens abaixo foram criadas com a ferramenta integrada `image_gen`, como fotografias ilustrativas para este layout. Não representam uma instalação real verificada. Os originais estão preservados nesta pasta.

## Prompts utilizados

### online.png

Use case: photorealistic-natural. A beautiful photorealistic editorial photograph for an online psychotherapy service, landscape 3:2, 1536x1024 or higher. A complete open unbranded laptop with blank softly dark screen on a light oak desk next to a linen curtain, discreet ceramic mug and small green plant, warm natural morning light, cream and sage palette. Camera at seated eye level three quarter angle, show the entire laptop and desk arrangement with breathing room, centered main subject stays visible in 4:3 crops. Realistic tactile materials, restrained uncluttered composition, no people, no text, no logos, no watermark. It should feel like a calm private place to have a video conversation, refined lifestyle photography, sharp natural detail, not a 3D render.

### caminho.png

Use case: photorealistic-natural. Photorealistic fine art landscape photograph for a psychotherapy website, landscape 3:2 1536x1024 or higher. A gently curving pale stone garden path through soft green grasses and airy trees in early morning warm sunlight. Eye level, path leads from bottom center into midframe, intentional balanced composition with rich detailed leaves and soft atmospheric depth. Warm ivory highlights, muted natural sage greens, earthy neutrals, peaceful optimistic feeling. No people, no architecture, no words, no logos, no watermark. Beautiful real editorial photography, subtle natural color, no oversaturation. Subject readable in a wide 2:1 crop.

### botanica.png

Use case: photorealistic-natural. Photorealistic editorial still life for a therapist website, portrait 4:5 1200x1500 or higher. Close thoughtful composition of a small handmade ivory ceramic vase with delicate fresh green olive branches on a natural oak shelf, pale linen curtain and soft warm plaster wall in background. Sunlight makes gentle leaf shadows, genuine ceramic and wood grain detail, minimalist quiet intimate composition with the complete vase centered in lower middle and branches above, generous margins to tolerate cropping. Cream, warm wood, sage green. Professional lifestyle photograph with crisp focal detail, no excessive blur, no people, no text, no logos, no watermark.

### recomeco.png

Use case: photorealistic-natural. Photorealistic editorial architecture photograph for the closing invitation of a psychotherapy website. Portrait 4:5, 1200x1500 or higher. View from a quiet warm ivory plaster interior through an open tall wooden doorway onto a small sunlit garden courtyard with olive tree and green foliage. The doorway fully visible, centered, beautiful pale stone floor and subtle shadows leading outside. Warm morning natural light, sage greens, ivory and oak, tactile material detail, serene welcoming feeling of a new beginning. Understated and real, not lavish, no chairs or sofa, no people, no text, no logos, no watermark. Beautiful professional architectural photography, balanced exposure with garden detail visible.

## Preparação

`npm run images:prepare` gera variantes WebP em `optimized/` e atualiza `src/config/image-manifest.json`, sem ampliar os originais. Cada seção usa uma fotografia distinta; `Photo.jsx` fornece dimensões reais, `srcSet`, `sizes` e decodificação assíncrona. A imagem de abertura tem prioridade de carregamento; as demais são carregadas sob demanda.
