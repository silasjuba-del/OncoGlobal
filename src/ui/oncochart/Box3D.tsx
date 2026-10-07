import type { CSSProperties, ReactNode } from "react";

/** Primitivo CSS preserve-3d (≤200 caixas na cena; sem R3F nesta onda). */
export function Box3D({
  x = 0,
  y = 0,
  z = 0,
  w,
  h,
  d,
  color,
  ghost,
  title,
  className = "",
  style,
  onClick,
}: {
  x?: number;
  y?: number;
  z?: number;
  w: number;
  h: number;
  d: number;
  color: string;
  ghost?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const face = (W: number, H: number, tf: string, shade: number, key: string): ReactNode => (
    <div
      key={key}
      className="oc-b3f"
      style={{
        width: W,
        height: H,
        marginLeft: -W / 2,
        marginTop: -H / 2,
        transform: tf,
        background: ghost
          ? "transparent"
          : `color-mix(in oklch, ${color} ${shade}%, oklch(0.18 0.03 280))`,
        borderColor: color,
      }}
    />
  );

  return (
    <div
      className={`oc-b3 ${ghost ? "oc-b3-ghost" : ""} ${className}`.trim()}
      title={title}
      data-box3d=""
      onClick={onClick}
      style={{
        transform: `translate3d(${x}px, ${y - h / 2}px, ${z}px)`,
        ...style,
      }}
    >
      {face(w, h, `translateZ(${d / 2}px)`, 88, "f")}
      {face(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, 64, "b")}
      {face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, 72, "r")}
      {face(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, 72, "l")}
      {face(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, 100, "t")}
    </div>
  );
}
