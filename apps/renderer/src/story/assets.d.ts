// Remotion's bundler turns an imported image into its served URL.
declare module '*.svg' {
  const src: string
  export default src
}
