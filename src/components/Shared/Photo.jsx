// Cada foto escolhe a resolução adequada ao espaço e à densidade da tela.
export default function Photo({ image, sizes = '100vw', loading = 'lazy', style, ...props }) {
  return <img src={image.src} srcSet={image.srcSet} sizes={sizes} width={image.width} height={image.height}
    alt={image.alt} loading={loading} decoding="async" style={{ objectPosition: image.position, ...style }} {...props} />;
}
