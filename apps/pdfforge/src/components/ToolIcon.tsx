import type { ToolDef } from '../tools/types';

export function ToolIcon({ tool, size = 48 }: { tool: ToolDef; size?: number }) {
  const long = tool.glyph.length > 2;
  return (
    <span
      className="tool-icon"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${tool.color} 22%, transparent)`,
        color: tool.color,
        fontSize: size * (long ? 0.28 : 0.46),
        borderColor: `color-mix(in srgb, ${tool.color} 45%, transparent)`,
      }}
      aria-hidden
    >
      {tool.glyph}
    </span>
  );
}
