import JSZip from 'jszip';
/** Cada resultado ocupa uma entrada propria, inclusive colisoes com sufixos existentes. */
export async function zipOutputs(outputs: readonly { name: string; bytes: Uint8Array }[]) {
  const zip = new JSZip(), usados = new Set<string>();
  for (const output of outputs) {
    const original = output.name.replaceAll('\\', '/').split('/').pop() || 'arquivo';
    const dot = original.lastIndexOf('.'), base = dot > 0 ? original.slice(0, dot) : original, ext = dot > 0 ? original.slice(dot) : '';
    let name = original, numero = 1;
    while (usados.has(name.toLocaleLowerCase('en-US'))) name = `${base} (${numero++})${ext}`;
    usados.add(name.toLocaleLowerCase('en-US')); zip.file(name, output.bytes);
  }
  return zip.generateAsync({ type: 'uint8array' });
}
